/**
 * Public client-telemetry sink.
 *
 * The browser cannot hold SESSION_API_KEY, so unlike /api/internal/track this
 * endpoint is intentionally unauthenticated — it's the same trust level as the
 * old direct client `addDoc(analytics_events, …)` (anyone could already forge
 * those). Moving the write server-side lets the Firestore rules deny ALL client
 * writes to analytics_events (admin SDK only), closing that surface while
 * preserving client-side analytics.
 *
 * Input is validated and size-capped to bound abuse; writes go through the
 * admin SDK with source:"client" to match the existing analytics_events schema.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
    assignmentsToContext,
    EXPERIMENT_COOKIE,
    EXPERIMENT_QA_COOKIE,
    isExperimentMeasurable,
    parseExperimentAssignments,
    VISITOR_COOKIE,
} from "@/lib/experiments";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | null {
    return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}

function attribution(v: unknown): Record<string, string> {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const row = v as Record<string, unknown>;
    const allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing_page"];
    return Object.fromEntries(allowed.flatMap((key) => {
        const value = str(row[key], 300);
        return value ? [[key, value]] : [];
    }));
}

function userProperties(v: unknown): Record<string, string> {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const row = v as Record<string, unknown>;
    const allowed = ["plan", "credits", "onboarding_step", "signup_method", "is_paid"];
    return Object.fromEntries(allowed.flatMap((key) => {
        const value = str(row[key], 100);
        return value ? [[key, value]] : [];
    }));
}

export async function POST(req: NextRequest) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const event = str(body.event, 100);
    if (!event) {
        return NextResponse.json({ ok: false, error: "missing_event" }, { status: 400 });
    }

    // Only accept a plain object for params, and cap its serialized size.
    let params: Record<string, unknown> = {};
    if (body.params && typeof body.params === "object" && !Array.isArray(body.params)) {
        try {
            if (JSON.stringify(body.params).length <= 4000) {
                params = body.params as Record<string, unknown>;
            }
        } catch { /* non-serializable params → drop them */ }
    }

    // Firestore reporting trusts only the assignment issued by our middleware,
    // never experiment fields supplied in the public request body.
    const allAssignments = assignmentsToContext(parseExperimentAssignments(
        req.cookies.get(EXPERIMENT_COOKIE)?.value
    ));
    const isQa = req.cookies.get(EXPERIMENT_QA_COOKIE)?.value === "1";
    const canonicalExperiments = allAssignments.filter((row) => isQa || isExperimentMeasurable(row.id));
    const canonicalParams = { ...params };
    delete canonicalParams.experiment_id;
    delete canonicalParams.experiment_variant;
    delete canonicalParams.experiment_source;
    delete canonicalParams.experiment_qa;
    delete canonicalParams.visitor_id;
    if (canonicalExperiments.length > 0) {
        canonicalParams.experiment_id = canonicalExperiments.map((row) => row.id).join(",");
        canonicalParams.experiment_variant = canonicalExperiments.map((row) => row.variant).join(",");
        canonicalParams.experiment_source = "server";
    }
    canonicalParams.experiment_qa = isQa ? "true" : "false";

    if (event === "experiment_exposure") {
        const requestedId = str(params.experiment_id, 100);
        const requestedVariant = str(params.experiment_variant, 100);
        const matchesAssignment = canonicalExperiments.some(
            (row) => row.id === requestedId && row.variant === requestedVariant
        );
        if (!matchesAssignment) {
            return NextResponse.json({ ok: false, error: "invalid_experiment_assignment" }, { status: 400 });
        }
        canonicalParams.experiment_id = requestedId;
        canonicalParams.experiment_variant = requestedVariant;
        canonicalParams.experiment_source = "server";
    }

    try {
        await adminDb.collection("analytics_events").add({
            event,
            params: canonicalParams,
            user_id: str(body.user_id, 128),
            session_id: str(body.session_id, 128),
            page_path: str(body.page_path, 300),
            user_agent: str(body.user_agent, 200),
            visitor_id: str(req.cookies.get(VISITOR_COOKIE)?.value, 128),
            experiment_qa: isQa,
            attribution: attribution(body.attribution),
            locale: str(body.locale, 40),
            screen: str(body.screen, 40),
            authenticated: body.authenticated === true,
            user_properties: userProperties(body.user_properties),
            country: str(req.headers.get("x-vercel-ip-country"), 10),
            experiments: canonicalExperiments,
            timestamp: FieldValue.serverTimestamp(),
            source: "client",
        });
    } catch {
        return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
