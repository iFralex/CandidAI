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
import { recordServerEvent } from "@/lib/server-track";

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

    await recordServerEvent({
        event: body.event,
        params: { ...(body.params ?? {}), ...(body.occurred_at ? { occurred_at: body.occurred_at } : {}) },
        userId: body.user_id,
    });
    return NextResponse.json({ ok: true });
}
