/**
 * Drip campaign for stalled users.
 *
 * Runs daily at 09:00 UTC (1h after the analytics digest, so a slow Resend
 * batch never delays the digest email). Targets users who signed up 48-96h
 * ago and are stuck below onboarding step 3 — they registered, then dropped
 * before doing anything meaningful with the product.
 *
 * Idempotency: marks `drip_stalled_sent: true` on the user doc after the
 * send goes through. The query excludes anyone already flagged, so a manual
 * re-trigger won't double-mail. Errors per-user don't abort the whole batch.
 *
 * Auth: Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
 * Also accepts SESSION_API_KEY for manual triggers from the operator.
 *
 * Manual test:
 *   curl -H "Authorization: Bearer $SESSION_API_KEY" \
 *     https://candidai.tech/api/cron/drip-stalled
 */
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { recordServerEvent } from "@/lib/server-track";
import { wrapEmail, button, tipBox, heading, paragraph, escapeHtml } from "@/lib/email-template";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DRIP_FROM = "Alessio (CandidAI) <no-reply@candidai.tech>";
const DRIP_REPLY_TO = "hello@candidai.tech";
const STALLED_MIN_HOURS = 48;
const STALLED_MAX_HOURS = 96;
const STALLED_MAX_STEP = 3;

function isAuthorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return false;
    return token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    // users.createdAt is stored as an ISO 8601 string (see /api/auth and
    // login-form Google flow). ISO 8601 is lexicographically ordered, so
    // string range queries on Firestore work correctly without a converter.
    // (Previous code compared against Timestamp objects and matched 0 docs.)
    const minIso = new Date(now - STALLED_MAX_HOURS * 3600_000).toISOString();
    const maxIso = new Date(now - STALLED_MIN_HOURS * 3600_000).toISOString();

    // We can't filter onboardingStep + createdAt + missing-drip-flag in a
    // single query without composite indexes, so we query by createdAt range
    // (the most selective) and filter the rest in JS.
    const snap = await adminDb
        .collection("users")
        .where("createdAt", ">=", minIso)
        .where("createdAt", "<", maxIso)
        .get();

    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent: string[] = [];
    const skipped: { uid: string; reason: string }[] = [];
    const failed: { uid: string; error: string }[] = [];

    for (const doc of snap.docs) {
        const u = doc.data();
        const uid = doc.id;
        const step = Number(u.onboardingStep ?? 0);
        const email = u.email as string | undefined;
        const alreadySent = u.drip_stalled_sent === true;

        if (alreadySent) { skipped.push({ uid, reason: "already_sent" }); continue; }
        if (u.unsubscribed === true) { skipped.push({ uid, reason: "unsubscribed" }); continue; }
        if (step >= STALLED_MAX_STEP) { skipped.push({ uid, reason: `step=${step}` }); continue; }
        if (!email) { skipped.push({ uid, reason: "no_email" }); continue; }

        const name = (u.name as string | undefined)?.split(" ")[0] ?? "";
        const unsubscribeUrl = buildUnsubscribeUrl(uid);
        try {
            const { error } = await resend.emails.send({
                from: DRIP_FROM,
                to: email,
                replyTo: DRIP_REPLY_TO,
                subject: name ? `${name}, you got stuck halfway` : "You got stuck halfway on CandidAI",
                html: renderDripHtml(name, unsubscribeUrl),
                headers: {
                    // RFC 8058 one-click unsubscribe — Gmail/Apple Mail show a
                    // native "Unsubscribe" button next to the sender.
                    "List-Unsubscribe": `<${unsubscribeUrl}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
            });
            if (error) throw new Error(JSON.stringify(error));

            await doc.ref.update({
                drip_stalled_sent: true,
                drip_stalled_sent_at: FieldValue.serverTimestamp(),
            });
            sent.push(uid);
            const createdAtMs = new Date(String(u.createdAt ?? "")).getTime();
            const hoursSinceSignup = Number.isFinite(createdAtMs)
                ? Math.round((now - createdAtMs) / 3600_000)
                : null;
            await recordServerEvent({
                event: "drip_stalled_sent",
                userId: uid,
                params: { onboarding_step: step, hours_since_signup: hoursSinceSignup },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failed.push({ uid, error: message.slice(0, 200) });
            console.error(`Drip send failed for ${uid}:`, message);
        }
    }

    return NextResponse.json({
        ok: true,
        candidates: snap.size,
        sent: sent.length,
        skipped: skipped.length,
        failed: failed.length,
        details: { sent, skipped, failed },
    });
}

function renderDripHtml(firstName: string, unsubscribeUrl: string): string {
    const greeting = firstName ? `Hey ${escapeHtml(firstName)},` : "Hey there,";
    return wrapEmail(`
        ${heading(greeting)}
        ${paragraph(`I'm Alessio, the creator of CandidAI. I noticed you signed up a couple of days ago but didn't make it past the first onboarding steps.`)}
        ${paragraph(`That's completely normal — most people don't finish on the first pass. But I'd really like to understand <strong style="color: #8b5cf6;">what held you back</strong>:`)}
        <ul style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 24px; padding-left: 22px;">
            <li style="margin-bottom: 6px;">The next step wasn't clear?</li>
            <li style="margin-bottom: 6px;">You didn't have your CV at hand?</li>
            <li>You were looking for something different?</li>
        </ul>
        ${paragraph(`Just reply with a one-liner (even &ldquo;I was just testing&rdquo; helps me). And if you want to pick up where you left off, your account is right here:`)}
        <div style="text-align: center; margin: 32px 0;">
            ${button("Resume my onboarding →", "https://candidai.tech/dashboard")}
        </div>
        ${tipBox(`<strong style="color: #8b5cf6;">📝 Why I'm asking:</strong> Every reply makes the product better for the next person who signs up. No marketing tricks, just trying to figure out where we're losing people.`)}
        <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Thanks,<br>Alessio</p>
    `, { preheader: "I'd love to know what made you stop — even one line helps.", badge: "QUICK CHECK-IN", unsubscribeUrl });
}
