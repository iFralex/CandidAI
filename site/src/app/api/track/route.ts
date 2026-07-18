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

export const runtime = "nodejs";

function str(v: unknown, max: number): string | null {
    return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
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

    try {
        await adminDb.collection("analytics_events").add({
            event,
            params,
            user_id: str(body.user_id, 128),
            session_id: str(body.session_id, 128),
            page_path: str(body.page_path, 300),
            user_agent: str(body.user_agent, 200),
            timestamp: FieldValue.serverTimestamp(),
            source: "client",
        });
    } catch {
        return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
