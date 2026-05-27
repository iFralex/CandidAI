/**
 * Onboarding email sequence — runs daily at 10:00 UTC, in addition to the
 * stalled-user drip cron at 09:00. Walks every signup through 4 stages:
 *
 *   Day 1   welcome              → everyone
 *   Day 3   feature_tip          → everyone still active
 *   Day 7   case_study           → not-yet-paid users
 *   Day 14  upgrade_offer        → still on free_trial
 *
 * Each stage marks `seq_<stage>_sent` on the user doc → idempotent across
 * re-runs and manual triggers. Per-user errors don't abort the batch.
 *
 * Auth: same pattern as the other crons (CRON_SECRET or SESSION_API_KEY).
 *
 * Manual test:
 *   curl -H "Authorization: Bearer $SESSION_API_KEY" \
 *     https://candidai.tech/api/cron/onboarding-sequence
 */
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { recordServerEvent } from "@/lib/server-track";
import { wrapEmail, button, tipBox, heading, paragraph, escapeHtml } from "@/lib/email-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FROM = "Alessio (CandidAI) <no-reply@candidai.tech>";
const REPLY_TO = "hello@candidai.tech";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";
const DAY_MS = 86400_000;

function isAuthorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return false;
    return token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY;
}

interface StageConfig {
    key: string;
    windowDays: [number, number];   // [start, end) days since signup
    extraFilter?: (u: Record<string, unknown>) => boolean;
    render: (firstName: string) => { subject: string; html: string };
}

const STAGES: StageConfig[] = [
    { key: "welcome",        windowDays: [1, 3],  render: renderWelcome },
    { key: "feature_tip",    windowDays: [3, 5],  render: renderFeatureTip },
    {
        key: "case_study",
        windowDays: [7, 9],
        extraFilter: (u) => (u.plan as string | undefined) === "free_trial" || !u.plan,
        render: renderCaseStudy,
    },
    {
        key: "upgrade_offer",
        windowDays: [14, 16],
        extraFilter: (u) => (u.plan as string | undefined) === "free_trial",
        render: renderUpgradeOffer,
    },
];

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = Date.now();
    const results: Record<string, { candidates: number; sent: number; skipped: number; failed: number }> = {};

    for (const stage of STAGES) {
        const flagField = `seq_${stage.key}_sent`;
        const minTs = Timestamp.fromMillis(now - stage.windowDays[1] * DAY_MS);
        const maxTs = Timestamp.fromMillis(now - stage.windowDays[0] * DAY_MS);

        const snap = await adminDb
            .collection("users")
            .where("createdAt", ">=", minTs)
            .where("createdAt", "<", maxTs)
            .get();

        let sent = 0, skipped = 0, failed = 0;

        for (const doc of snap.docs) {
            const u = doc.data();
            const uid = doc.id;
            const email = u.email as string | undefined;

            if (u[flagField] === true) { skipped++; continue; }
            if (!email) { skipped++; continue; }
            if (stage.extraFilter && !stage.extraFilter(u)) { skipped++; continue; }

            const firstName = (u.name as string | undefined)?.split(" ")[0] ?? "";
            const { subject, html } = stage.render(firstName);

            try {
                const { error } = await resend.emails.send({
                    from: FROM, to: email, replyTo: REPLY_TO, subject, html,
                });
                if (error) throw new Error(JSON.stringify(error));

                await doc.ref.update({
                    [flagField]: true,
                    [`${flagField}_at`]: FieldValue.serverTimestamp(),
                });
                sent++;
                await recordServerEvent({
                    event: "onboarding_email_sent",
                    userId: uid,
                    params: { stage: stage.key, days_since_signup: stage.windowDays[0] },
                });
            } catch (err) {
                failed++;
                console.error(`[${stage.key}] send failed for ${uid}:`, err);
            }
        }

        results[stage.key] = { candidates: snap.size, sent, skipped, failed };
    }

    return NextResponse.json({ ok: true, results });
}

// ─── Email templates (English, shared CandidAI design system) ─────────────

function greet(firstName: string): string {
    return firstName ? `Hey ${escapeHtml(firstName)}! 👋` : "Hey there! 👋";
}

// ── Stage 1: welcome (day 1) ──────────────────────────────────────────────
function renderWelcome(firstName: string) {
    return {
        subject: firstName ? `${firstName}, welcome to CandidAI 🚀` : "Welcome to CandidAI 🚀",
        html: wrapEmail(`
            ${heading(greet(firstName))}
            ${paragraph(`I'm Alessio, the creator of CandidAI. Thanks for signing up!`)}
            ${paragraph(`In a nutshell, CandidAI sends ultra-personalized emails to targeted recruiters on your behalf — based on your CV and the companies you want to reach. Three quick steps to get started:`)}
            <ol style="color: #cccccc; font-size: 15px; line-height: 1.7; margin: 0 0 24px; padding-left: 22px;">
                <li style="margin-bottom: 8px;">Upload your CV (PDF or DOCX, we'll parse everything automatically)</li>
                <li style="margin-bottom: 8px;">Add 1-2 companies where you'd love to work</li>
                <li>Review the generated email, tweak it if needed, and hit <strong style="color: #8b5cf6;">Send</strong></li>
            </ol>
            <div style="text-align: center; margin: 32px 0;">
                ${button("Continue my onboarding →", `${DOMAIN}/dashboard`)}
            </div>
            ${tipBox(`<strong style="color: #8b5cf6;">💡 Did you know?</strong> Personalized emails to recruiters get a <strong>5× higher reply rate</strong> than generic applications. You're already ahead of the game.`)}
            ${paragraph(`If anything blocks you, just reply to this email — I read every message personally.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">See you soon,<br>Alessio</p>
        `, { preheader: "Three quick steps to start sending personalized emails to recruiters.", badge: "WELCOME ABOARD" }),
    };
}

// ── Stage 2: feature_tip (day 3) ──────────────────────────────────────────
function renderFeatureTip(firstName: string) {
    return {
        subject: firstName ? `${firstName}, a feature you might have missed` : "A feature you might have missed",
        html: wrapEmail(`
            ${heading(greet(firstName))}
            ${paragraph(`Quick tip most users miss: if the recruiter we found for you doesn't feel right, you can <strong style="color: #8b5cf6;">search for a different one in one click</strong> from your dashboard.`)}
            ${paragraph(`You can also edit the tone or content of the generated email before sending — no need to rewrite from scratch, just tweak a few lines. And if the draft doesn't convince you at all, the <strong style="color: #8b5cf6;">Regenerate</strong> button creates a fresh alternative.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("Open my dashboard →", `${DOMAIN}/dashboard`)}
            </div>
            ${tipBox(`<strong style="color: #8b5cf6;">🎯 Pro tip:</strong> The first generated email is usually 80% there. Five minutes of editing on your end is what makes the difference between "another AI email" and one that gets a reply.`)}
            ${paragraph(`If you haven't tried these yet, now's a good moment.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Cheers,<br>Alessio</p>
        `, { preheader: "Change the recruiter, edit the tone, regenerate the draft — small things that change the outcome.", badge: "PRO TIP" }),
    };
}

// ── Stage 3: case_study (day 7) ────────────────────────────────────────────
function renderCaseStudy(firstName: string) {
    return {
        subject: firstName ? `${firstName}, how Marie landed 3 interviews in 10 days` : "How Marie landed 3 interviews in 10 days",
        html: wrapEmail(`
            ${heading("How Marie landed 3 interviews in 10 days")}
            ${paragraph(`Marie is a French user who was targeting a marketing apprenticeship. She uploaded her CV, picked <strong style="color: #8b5cf6;">5 companies</strong>, and sent the CandidAI-generated emails to a specific recruiter at each one.`)}
            ${paragraph(`Result: <strong style="color: #8b5cf6;">3 positive replies in 10 days</strong>, two of which turned into interviews. Zero LinkedIn scrolling, zero blind applications — just 5 ultra-personalized emails to the right contact.`)}
            ${tipBox(`<strong style="color: #8b5cf6;">📬 Why it works:</strong> CandidAI identifies <em>who</em> to email (not a generic <code style="background: rgba(139, 92, 246, 0.15); padding: 2px 6px; border-radius: 4px; color: #c4b5fd;">jobs@</code> address), writes a message that proves you know the company, and you just review and send.`)}
            ${paragraph(`If you have your CV uploaded and a company or two added, you're already set up for the same outcome — you just need to send.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("Go to my dashboard →", `${DOMAIN}/dashboard`)}
            </div>
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Talk soon,<br>Alessio</p>
        `, { preheader: "5 emails, 3 replies, 2 interviews — a real user's story.", badge: "CASE STUDY" }),
    };
}

// ── Stage 4: upgrade_offer (day 14) ────────────────────────────────────────
function renderUpgradeOffer(firstName: string) {
    return {
        subject: firstName ? `${firstName}, -15% on every plan (7 days only)` : "-15% on every plan (7 days only)",
        html: wrapEmail(`
            ${heading("A small thank-you 🎁")}
            ${paragraph(`You've been with CandidAI for two weeks on the free trial — I hope it's been useful.`)}
            ${paragraph(`If you want to expand to more target companies, here's a discount code on me:`)}
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: rgba(139, 92, 246, 0.15); border: 1px dashed rgba(139, 92, 246, 0.5); padding: 14px 28px; border-radius: 10px;">
                    <code style="color: #c4b5fd; font-size: 20px; font-weight: 700; letter-spacing: 2px; font-family: 'SF Mono', Menlo, monospace;">WELCOME15</code>
                </div>
            </div>
            ${paragraph(`<strong style="color: #ffffff;">15% off any plan</strong>, valid for 7 days. Apply at checkout.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("See plans →", `${DOMAIN}/dashboard/plan-and-credits`)}
            </div>
            ${paragraph(`If you have questions about which plan fits your case, just reply to this email.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Cheers,<br>Alessio</p>
        `, { preheader: "Discount code WELCOME15 — valid 7 days on any plan.", badge: "MEMBER OFFER" }),
    };
}
