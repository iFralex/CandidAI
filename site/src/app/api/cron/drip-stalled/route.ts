/**
 * Compatibility endpoint for the retired stalled-user cron.
 * Lifecycle reminders are now exclusively orchestrated by
 * /api/cron/onboarding-sequence, which applies shared cooldown,
 * preferences, and idempotency rules.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return Boolean(token) && (token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY);
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
        ok: true,
        disabled: true,
        replacement: "/api/cron/onboarding-sequence",
    });
}
