/**
 * Internal server-to-server analytics endpoint.
 *
 * Used by the Python pipeline (and other backend code) to write events
 * directly to Firestore `analytics_events`. Browser tracking via
 * `track()` in `@/lib/analytics` handles the client side; this is for
 * server-only signals (pipeline lifecycle, recruiter lookup failures,
 * scrape errors, Stripe revenue, etc.) that the browser can never see.
 *
 * Auth: shared secret via `X-Internal-Key` header — must match
 * `SESSION_API_KEY` (already used by /analytics dashboard Basic Auth).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

interface TrackPayload {
    event: string;
    params?: Record<string, unknown>;
    user_id?: string | null;
    /** ISO 8601 timestamp from the caller (optional — we default to server time) */
    occurred_at?: string;
}

function isAuthorized(req: NextRequest): boolean {
    const key = process.env.SESSION_API_KEY;
    if (!key) return false;
    const provided = req.headers.get("x-internal-key");
    return provided === key;
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: TrackPayload;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    if (!body.event || typeof body.event !== "string") {
        return NextResponse.json({ error: "missing event" }, { status: 400 });
    }

    try {
        await adminDb.collection("analytics_events").add({
            event: body.event,
            params: body.params ?? {},
            user_id: body.user_id ?? null,
            session_id: null,
            page_path: null,
            timestamp: FieldValue.serverTimestamp(),
            source: "server",
            // Preserve caller's occurred_at if provided (server time may lag for async events)
            occurred_at: body.occurred_at ?? null,
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to persist server-side analytics event:", message);
        return NextResponse.json({ error: "write_failed", message }, { status: 500 });
    }
}
