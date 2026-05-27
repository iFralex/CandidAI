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

interface AccountContext {
    hasCv: boolean;
    hasCompanies: boolean;
    hasCustomizations: boolean;
}

interface StageConfig {
    key: string;
    windowDays: [number, number];   // [start, end) days since signup
    extraFilter?: (u: Record<string, unknown>) => boolean;
    /** If true, fetch users/{uid}/data/account before rendering. */
    needsAccountData?: boolean;
    render: (firstName: string, ctx?: AccountContext) => { subject: string; html: string };
}

const STAGES: StageConfig[] = [
    // Day 1-3: actionable check-in, not a generic welcome. The /api/auth signup
    // path already sends a "Verify My Account" welcome; this one diagnoses
    // exactly where the user got stuck and points them at the next step.
    // Skipped for anyone who already finished onboarding within the window.
    {
        key: "first_action_check",
        windowDays: [1, 3],
        extraFilter: (u) => Number(u.onboardingStep ?? 0) < 5,
        needsAccountData: true,
        render: renderFirstActionCheck,
    },
    { key: "feature_tip", windowDays: [3, 5], render: renderFeatureTip },
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

            let ctx: AccountContext | undefined;
            if (stage.needsAccountData) {
                try {
                    const accountSnap = await adminDb
                        .collection("users").doc(uid).collection("data").doc("account").get();
                    const a = accountSnap.exists ? accountSnap.data() ?? {} : {};
                    ctx = {
                        hasCv: !!a.cvUrl,
                        hasCompanies: Array.isArray(a.companies) && a.companies.length > 0,
                        hasCustomizations: !!a.customizations,
                    };
                } catch {
                    ctx = { hasCv: false, hasCompanies: false, hasCustomizations: false };
                }
            }

            const { subject, html } = stage.render(firstName, ctx);

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

// ── Stage 1: first_action_check (day 1-3) ────────────────────────────────
// Diagnoses what the user has actually done vs. what's still missing, then
// points at exactly the next step. Not a "welcome" — the /api/auth signup
// flow already sends one. Skipped if onboardingStep >= 5 (= already done).
function renderFirstActionCheck(firstName: string, ctx?: AccountContext) {
    const c = ctx ?? { hasCv: false, hasCompanies: false, hasCustomizations: false };
    const allDone = c.hasCv && c.hasCompanies && c.hasCustomizations;

    // Compute next step + CTA destination based on what's missing.
    const nextStep = !c.hasCompanies
        ? { label: "Add your first company", url: `${DOMAIN}/dashboard` }
        : !c.hasCv
            ? { label: "Upload your CV", url: `${DOMAIN}/dashboard` }
            : !c.hasCustomizations
                ? { label: "Customize your email tone", url: `${DOMAIN}/dashboard` }
                : { label: "Open my dashboard", url: `${DOMAIN}/dashboard` };

    const item = (done: boolean, label: string) => `
        <li style="display: flex; align-items: center; margin: 0 0 10px; color: ${done ? "#888888" : "#cccccc"}; font-size: 15px; ${done ? "text-decoration: line-through;" : ""}">
            <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: ${done ? "#22c55e" : "rgba(139, 92, 246, 0.15)"}; border: ${done ? "none" : "1px solid rgba(139, 92, 246, 0.5)"}; color: white; text-align: center; line-height: 20px; font-size: 12px; margin-right: 12px; flex-shrink: 0;">${done ? "✓" : ""}</span>
            ${label}
        </li>`;

    return {
        subject: allDone
            ? (firstName ? `${firstName}, you're ready — send your first email` : "You're ready — send your first email")
            : (firstName ? `${firstName}, ready to send your first email?` : "Ready to send your first email?"),
        html: wrapEmail(`
            ${heading(greet(firstName))}
            ${paragraph(allDone
                ? `Quick check-in: your setup is complete! Your AI-generated email is in the dashboard waiting for you to review and send.`
                : `Quick check-in on your onboarding. Here's where you are right now:`)}
            <ul style="list-style: none; padding: 0; margin: 0 0 28px;">
                ${item(c.hasCompanies, "Add a target company")}
                ${item(c.hasCv, "Upload your CV")}
                ${item(c.hasCustomizations, "Set your email preferences")}
            </ul>
            ${allDone
                ? paragraph(`Just one click left.`)
                : paragraph(`<strong style="color: #ffffff;">Next:</strong> ${escapeHtml(nextStep.label)}. Takes 2 minutes.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button(allDone ? "Review my email →" : nextStep.label + " →", nextStep.url)}
            </div>
            ${tipBox(`<strong style="color: #8b5cf6;">💡 Did you know?</strong> Personalized emails to recruiters get a <strong>5× higher reply rate</strong> than generic applications. The setup is what unlocks that.`)}
            ${paragraph(`If something's blocking you — anything — reply to this email. I read every message personally.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Thanks,<br>Alessio</p>
        `, {
            preheader: allDone
                ? "Your email is generated and waiting for review."
                : `Next: ${nextStep.label}. Two minutes max.`,
            badge: allDone ? "READY TO SEND" : "QUICK CHECK-IN",
        }),
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
        subject: firstName
            ? `${firstName}, how Linnea got 2 backend interviews at Stockholm startups in 12 days`
            : "How Linnea got 2 backend interviews at Stockholm startups in 12 days",
        html: wrapEmail(`
            ${heading("How Linnea got 2 backend interviews at Stockholm startups in 12 days")}
            ${paragraph(`Linnea is a Swedish CS grad targeting <strong style="color: #ffffff;">backend engineering roles at Stockholm-based tech startups</strong>. She uploaded her CV, picked <strong style="color: #8b5cf6;">8 companies</strong> — a mix of names everyone knows (Klarna, Spotify, Tink, Voi) and four lesser-known YC-backed startups she'd been following on Twitter.`)}
            ${paragraph(`She sent the CandidAI-generated email to a specific engineering manager at each one.`)}

            <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.08) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 14px; padding: 22px 24px; margin: 24px 0;">
                <p style="color: #8b5cf6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 14px;">12 days later</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr><td style="padding: 6px 0; color: #cccccc; font-size: 14px;">📩 Replies</td><td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 18px; font-weight: 700;">4 / 8</td></tr>
                    <tr><td style="padding: 6px 0; color: #cccccc; font-size: 14px;">☎️ Intro calls</td><td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 18px; font-weight: 700;">3</td></tr>
                    <tr><td style="padding: 6px 0; color: #cccccc; font-size: 14px;">💻 Onsite technical interviews</td><td style="padding: 6px 0; text-align: right; color: #a78bfa; font-size: 18px; font-weight: 700;">2</td></tr>
                </table>
            </div>

            ${paragraph(`Zero generic <code style="background: rgba(139, 92, 246, 0.15); padding: 2px 6px; border-radius: 4px; color: #c4b5fd;">careers@</code> submissions, zero LinkedIn cold messages — just 8 emails, each referencing a recent engineering blog post that company had published.`)}
            ${tipBox(`<strong style="color: #8b5cf6;">📬 Why it works:</strong> CandidAI identifies <em>who</em> to email (the engineering manager, not the HR inbox), pulls a recent technical blog post the company shipped, and writes a message that proves you actually read what they're working on — not a template you sent to 100 other companies.`)}
            ${paragraph(`If you have your CV uploaded and a few companies picked, you're set up for the same outcome — you just need to review and send.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("Go to my dashboard →", `${DOMAIN}/dashboard`)}
            </div>
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Talk soon,<br>Alessio</p>
        `, {
            preheader: "8 emails, 4 replies, 2 onsite interviews — what a Stockholm CS grad did differently.",
            badge: "CASE STUDY",
        }),
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
