/**
 * /api/unsubscribe — flips users/{uid}.unsubscribed = true.
 *
 * Accepts both GET (clickable link in email footer → redirects user to a
 * confirmation page) and POST (RFC 8058 List-Unsubscribe one-click,
 * triggered by inbox-provider buttons like Gmail's native "Unsubscribe" —
 * must return 200 OK quickly with no redirect).
 *
 * Auth = signed token (HMAC of uid with SESSION_API_KEY). No login needed.
 *
 * Only marketing emails (cron/drip-stalled + cron/onboarding-sequence)
 * respect this flag. Transactional emails (payment receipts, password
 * reset, onboarding-complete, etc.) keep being delivered — they are
 * essential to the service, not opt-in marketing.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(uid: string | null, token: string | null) {
    if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
        return { ok: false, status: 400 as const, error: "invalid_token" };
    }
    try {
        await adminDb.collection("users").doc(uid).set({
            unsubscribed: true,
            unsubscribed_at: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { ok: true, status: 200 as const };
    } catch (err) {
        console.error("Unsubscribe write failed:", err);
        return { ok: false, status: 500 as const, error: "write_failed" };
    }
}

export async function GET(req: NextRequest) {
    const uid = req.nextUrl.searchParams.get("uid");
    const token = req.nextUrl.searchParams.get("token");
    const result = await handle(uid, token);

    const domain = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";
    const redirectUrl = new URL("/unsubscribed", domain);
    if (!result.ok) redirectUrl.searchParams.set("error", result.error ?? "unknown");
    return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function POST(req: NextRequest) {
    // RFC 8058 one-click: parameters can come either in the query string or
    // as a form-encoded body (some providers pick one, some the other).
    const qsUid = req.nextUrl.searchParams.get("uid");
    const qsToken = req.nextUrl.searchParams.get("token");

    let bodyUid: string | null = null;
    let bodyToken: string | null = null;
    try {
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("application/x-www-form-urlencoded")) {
            const body = await req.text();
            const params = new URLSearchParams(body);
            bodyUid = params.get("uid");
            bodyToken = params.get("token");
        }
    } catch { /* ignore parse errors */ }

    const result = await handle(qsUid ?? bodyUid, qsToken ?? bodyToken);
    return new NextResponse(result.ok ? "OK" : "error", { status: result.status });
}
