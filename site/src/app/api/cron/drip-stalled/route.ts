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
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { recordServerEvent } from "@/lib/server-track";

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
    const minTs = Timestamp.fromMillis(now - STALLED_MAX_HOURS * 3600_000);
    const maxTs = Timestamp.fromMillis(now - STALLED_MIN_HOURS * 3600_000);

    // We can't filter onboardingStep + createdAt + missing-drip-flag in a
    // single query without composite indexes, so we query by createdAt range
    // (the most selective) and filter the rest in JS.
    const snap = await adminDb
        .collection("users")
        .where("createdAt", ">=", minTs)
        .where("createdAt", "<", maxTs)
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
        if (step >= STALLED_MAX_STEP) { skipped.push({ uid, reason: `step=${step}` }); continue; }
        if (!email) { skipped.push({ uid, reason: "no_email" }); continue; }

        const name = (u.name as string | undefined)?.split(" ")[0] ?? "";
        try {
            const { error } = await resend.emails.send({
                from: DRIP_FROM,
                to: email,
                replyTo: DRIP_REPLY_TO,
                subject: name ? `${name}, tu t'es arrêté en chemin sur CandidAI` : "Tu t'es arrêté en chemin sur CandidAI",
                html: renderDripHtml(name),
            });
            if (error) throw new Error(JSON.stringify(error));

            await doc.ref.update({
                drip_stalled_sent: true,
                drip_stalled_sent_at: FieldValue.serverTimestamp(),
            });
            sent.push(uid);
            await recordServerEvent({
                event: "drip_stalled_sent",
                userId: uid,
                params: { onboarding_step: step, hours_since_signup: Math.round((now - (u.createdAt as Timestamp).toMillis()) / 3600_000) },
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

function renderDripHtml(firstName: string): string {
    const greeting = firstName ? `Salut ${escapeHtml(firstName)},` : "Salut,";
    return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#222;line-height:1.55">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;border:1px solid #eee;padding:28px">
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px">Je suis Alessio, le créateur de CandidAI. Je remarque que tu t'es inscrit il y a quelques jours mais que tu n'as pas continué après les premières étapes.</p>
    <p style="margin:0 0 16px">C'est tout à fait normal — la plupart des gens n'arrivent pas à la fin du premier passage. Mais j'aimerais bien comprendre <strong>ce qui t'a freiné</strong> :</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#555">
        <li>L'étape suivante n'était pas claire ?</li>
        <li>Tu n'avais pas ton CV sous la main ?</li>
        <li>Tu cherchais autre chose ?</li>
    </ul>
    <p style="margin:0 0 16px">Réponds-moi en une ligne (même un simple « j'ai juste testé » m'aide). Et si tu veux reprendre, tu retrouves ton compte ici :</p>
    <p style="margin:0 0 20px"><a href="https://candidai.tech/dashboard" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Continuer mon onboarding →</a></p>
    <p style="margin:0;color:#777">À bientôt,<br>Alessio</p>
    <p style="margin:24px 0 0;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px">
        Tu reçois ce message parce que tu t'es inscrit récemment sur candidai.tech.
        Pour ne plus recevoir de mails de ma part, réponds simplement « stop » à ce mail.
    </p>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
