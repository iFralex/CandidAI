/**
 * Unified onboarding lifecycle sequence — runs hourly. It handles contextual
 * recovery messages and the longer-term educational sequence in one scheduler:
 *
 *   Day 1   welcome              → everyone
 *   Day 3   feature_tip          → everyone still active
 *   Day 7   case_study           → not-yet-paid users
 *   Day 14  upgrade_offer        → still on free_trial
 *
 * The communications registry is the source of truth for idempotency and the
 * user-doc flags remain as backwards-compatible operational markers.
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
import { FieldValue } from "firebase-admin/firestore";
import { recordServerEvent } from "@/lib/server-track";
import { wrapEmail, button, tipBox, heading, paragraph, escapeHtml } from "@/lib/email-template";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { completeCommunication, failCommunication, reserveCommunication, type CommunicationCategory } from "@/lib/communication-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FROM = "Alessio (CandidAI) <no-reply@candidai.tech>";
const REPLY_TO = "hello@candidai.tech";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";
const DAY_MS = 86400_000;

function timestampMs(value: unknown): number {
    if (value && typeof value === "object" && "toMillis" in value && typeof (value as any).toMillis === "function") return (value as any).toMillis();
    return Date.parse(String(value ?? ""));
}

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
    stage?: string;
}

interface StageConfig {
    key: string;
    windowDays: [number, number];   // [start, end) days since signup
    extraFilter?: (u: Record<string, unknown>) => boolean;
    /** If true, fetch users/{uid}/data/account before rendering. */
    needsAccountData?: boolean;
    render: (firstName: string, unsubscribeUrl: string, ctx?: AccountContext) => { subject: string; html: string };
    category: CommunicationCategory;
}

const STAGES: StageConfig[] = [
    // Day 1-3: actionable check-in, not a generic welcome. The /api/auth signup
    // path already sends a "Verify My Account" welcome; this one diagnoses
    // exactly where the user got stuck and points them at the next step.
    // Skipped for anyone who already finished onboarding within the window.
    {
        key: "first_action_check",
        windowDays: [0.83, 3],
        extraFilter: (u) => Number(u.onboardingStep ?? 0) < 5,
        needsAccountData: true,
        render: renderFirstActionCheck,
        category: "onboarding",
    },
    {
        key: "preview_ready_followup",
        windowDays: [0, 30],
        extraFilter: (u) => {
            const activity = timestampMs(u.lastOnboardingActivityAt ?? u.freePreviewConsumedAt);
            return u.onboardingStage === "preview_ready"
                && (u.plan === "free_trial" || !u.plan)
                && Number.isFinite(activity)
                && Date.now() - activity >= 30 * 60_000;
        },
        render: renderPreviewReadyFollowup,
        category: "onboarding",
    },
    {
        key: "checkout_abandoned",
        windowDays: [0, 30],
        extraFilter: (u) => {
            const activity = timestampMs(u.lastOnboardingActivityAt);
            return u.onboardingStage === "checkout" && Number.isFinite(activity) && Date.now() - activity >= 4 * 60 * 60_000;
        },
        render: renderCheckoutAbandoned,
        category: "onboarding",
    },
    {
        key: "post_purchase_setup_resume",
        windowDays: [0, 30],
        extraFilter: (u) => {
            const activity = timestampMs(u.lastOnboardingActivityAt);
            return String(u.onboardingStage || "").startsWith("post_purchase")
                && Number.isFinite(activity)
                && Date.now() - activity >= 20 * 60 * 60_000;
        },
        render: renderPostPurchaseResume,
        category: "onboarding",
    },
    { key: "feature_tip", windowDays: [3, 5], render: renderFeatureTip, category: "marketing" },
    {
        key: "case_study",
        windowDays: [7, 9],
        extraFilter: (u) => (u.plan as string | undefined) === "free_trial" || !u.plan,
        render: renderCaseStudy,
        category: "marketing",
    },
    {
        key: "upgrade_offer",
        windowDays: [14, 16],
        extraFilter: (u) => (u.plan as string | undefined) === "free_trial",
        render: renderUpgradeOffer,
        category: "marketing",
    },
];

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = Date.now();
    const heartbeatRef = adminDb.collection("_system").doc("cron_onboarding_sequence");
    await heartbeatRef.set({ startedAt: FieldValue.serverTimestamp(), status: "running" }, { merge: true });
    const results: Record<string, { candidates: number; sent: number; skipped: number; failed: number }> = {};

    for (const stage of STAGES) {
        const flagField = `seq_${stage.key}_sent`;
        // users.createdAt is an ISO 8601 string (lexicographically sortable),
        // not a Firestore Timestamp — string range queries are correct here.
        const minIso = new Date(now - stage.windowDays[1] * DAY_MS).toISOString();
        const maxIso = new Date(now - stage.windowDays[0] * DAY_MS).toISOString();

        const snap = await adminDb
            .collection("users")
            .where("createdAt", ">=", minIso)
            .where("createdAt", "<", maxIso)
            .get();

        let sent = 0, skipped = 0, failed = 0;

        for (const doc of snap.docs) {
            const u = doc.data();
            const uid = doc.id;
            const email = u.email as string | undefined;

            if (u[flagField] === true) { skipped++; continue; }
            if (u.unsubscribed === true) { skipped++; continue; }
            if (!email) { skipped++; continue; }
            if (stage.extraFilter && !stage.extraFilter(u)) { skipped++; continue; }

            const firstName = (u.name as string | undefined)?.split(" ")[0] ?? "";
            const unsubscribeUrl = buildUnsubscribeUrl(uid);

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
                        stage: String(u.onboardingStage || "profile_source"),
                    };
                } catch {
                    ctx = { hasCv: false, hasCompanies: false, hasCustomizations: false, stage: String(u.onboardingStage || "profile_source") };
                }
            }

            const { subject, html } = stage.render(firstName, unsubscribeUrl, ctx);
            const dedupeKey = stage.key === "post_purchase_setup_resume"
                ? `lifecycle:${stage.key}:${String(u.onboardingStage || "unknown")}`
                : `lifecycle:${stage.key}`;

            try {
                const reservation = await reserveCommunication({
                    userId: uid,
                    dedupeKey,
                    type: stage.key,
                    category: stage.category,
                    metadata: { onboardingStage: u.onboardingStage ?? null, onboardingStep: u.onboardingStep ?? null },
                });
                if (!reservation.send) { skipped++; continue; }
                const { data: sendData, error } = await resend.emails.send({
                    from: FROM, to: email, replyTo: REPLY_TO, subject, html,
                    headers: {
                        "List-Unsubscribe": `<${unsubscribeUrl}>`,
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                }, { idempotencyKey: `${uid}:${dedupeKey}`.slice(0, 256) });
                if (error) throw new Error(JSON.stringify(error));

                await completeCommunication({ userId: uid, dedupeKey, category: stage.category, type: stage.key, providerId: sendData?.id });

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
                await failCommunication({ userId: uid, dedupeKey, error: err }).catch(() => undefined);
                console.error(`[${stage.key}] send failed for ${uid}:`, err);
            }
        }

        results[stage.key] = { candidates: snap.size, sent, skipped, failed };
    }

    await heartbeatRef.set({ completedAt: FieldValue.serverTimestamp(), status: "healthy", results }, { merge: true });
    return NextResponse.json({ ok: true, results });
}

// ─── Email templates (English, shared CandidAI design system) ─────────────

function greet(firstName: string): string {
    return firstName ? `Your application is moving, ${escapeHtml(firstName)}.` : "Your application is moving.";
}

function renderPreviewReadyFollowup(firstName: string, unsubscribeUrl: string) {
    return {
        subject: firstName ? `${firstName}, your first application is ready` : "Your first application is ready",
        html: wrapEmail(`
            ${heading(greet(firstName))}
            ${paragraph(`The research is complete: CandidAI selected the strongest recruiter match we found and wrote your first application around your profile and target company.`)}
            ${paragraph(`The result is saved. Open it to inspect why this recruiter was chosen, visit their LinkedIn profile, and copy or open the draft in your email app.`)}
            <div style="text-align: center; margin: 32px 0;">${button("Review my application →", `${DOMAIN}/dashboard`)}</div>
            ${tipBox(`<strong style="color: #8b5cf6;">What CandidAI users changed:</strong> their baseline response rate from traditional applications was about 2%; targeted CandidAI outreach reached about 40%. Results vary, but the mechanism is simple: reach a relevant person with a message built for that company.`)}
            ${paragraph(`Your free preview shows the recruiter and complete draft. A paid campaign adds the direct recruiter email, deeper company research, and definitive generation across 20, 50, or 100 target companies.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Talk soon,<br>Alessio</p>
        `, { preheader: "Your recruiter match and personalized email are waiting in CandidAI.", badge: "APPLICATION READY", unsubscribeUrl }),
    };
}

function renderCheckoutAbandoned(firstName: string, unsubscribeUrl: string) {
    return {
        subject: firstName ? `${firstName}, your application is still saved` : "Your application is still saved",
        html: wrapEmail(`
            ${heading(firstName ? `Your first result is still here, ${escapeHtml(firstName)}.` : "Your first result is still here.")}
            ${paragraph(`You reached plan selection after seeing the recruiter and email CandidAI created for you. Your profile, target company, recruiter match, and preview remain saved.`)}
            ${paragraph(`A paid campaign adds verified recruiter addresses and lets you generate across 20, 50, or 100 companies. Pro and Ultra also unlock control over recruiter criteria and writing instructions.`)}
            ${tipBox(`<strong style="color:#8b5cf6;">One real customer result:</strong> Sanne had sent about 40 portal applications without a human reply. Eight targeted CandidAI emails produced five human replies, three introductory calls, two interview processes, and one offer in roughly four weeks. Individual results vary.`)}
            <div style="text-align: center; margin: 32px 0;">${button("Return to my application →", `${DOMAIN}/dashboard`)}</div>
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">If something was unclear in checkout, reply to this email.<br>Alessio</p>
        `, { preheader: "Your first result and selected opportunity are still waiting.", badge: "PROGRESS SAVED", unsubscribeUrl }),
    };
}

function renderPostPurchaseResume(firstName: string, unsubscribeUrl: string) {
    return {
        subject: firstName ? `${firstName}, finish shaping your campaign` : "Finish shaping your campaign",
        html: wrapEmail(`
            ${heading(firstName ? `Your plan is active, ${escapeHtml(firstName)}. Shape the campaign before it runs.` : "Your plan is active. Shape the campaign before it runs.")}
            ${paragraph(`Your setup is saved. The choices still ahead determine which recruiters CandidAI prioritizes and which parts of your experience each email should bring forward.`)}
            ${paragraph(`Return to the exact section you left—candidate profile, companies, recruiter strategy, message direction, or launch review. We will not spend a generation until you confirm launch.`)}
            <div style="text-align: center; margin: 32px 0;">${button("Continue campaign setup →", `${DOMAIN}/dashboard`)}</div>
            ${tipBox(`<strong style="color: #8b5cf6;">Nothing will generate prematurely:</strong> the definitive campaign begins only when you confirm the launch review.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">See you inside,<br>Alessio</p>
        `, { preheader: "Your plan is active; complete the last campaign choices before launch.", badge: "CAMPAIGN SETUP", unsubscribeUrl }),
    };
}

// ── Stage 1: first_action_check (day 1-3) ────────────────────────────────
// Diagnoses what the user has actually done vs. what's still missing, then
// points at exactly the next step. Not a "welcome" — the /api/auth signup
// flow already sends one. Skipped if onboardingStep >= 5 (= already done).
function renderFirstActionCheck(firstName: string, unsubscribeUrl: string, ctx?: AccountContext) {
    const c = ctx ?? { hasCv: false, hasCompanies: false, hasCustomizations: false, stage: "profile_source" };
    const allDone = c.hasCv && c.hasCompanies && c.hasCustomizations;

    // Compute next step + CTA destination based on what's missing.
    const nextStep = c.stage === "profile_source" || !c.hasCv
        ? { label: "Build your candidate profile", url: `${DOMAIN}/dashboard` }
        : c.stage === "profile_review"
            ? { label: "Review your candidate story", url: `${DOMAIN}/dashboard` }
            : !c.hasCompanies
                ? { label: "Choose your target company", url: `${DOMAIN}/dashboard` }
            : !c.hasCustomizations
                ? { label: "Continue my first application", url: `${DOMAIN}/dashboard` }
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
                ? `Your first application has been assembled and saved. Open it to review the recruiter match and the message before deciding what to do next.`
                : `CandidAI saves each completed part, so you can continue without repeating the work. Here is the shortest path from where you stopped:`)}
            <ul style="list-style: none; padding: 0; margin: 0 0 28px;">
                ${item(c.hasCv, "Build your candidate profile")}
                ${item(c.hasCompanies, "Choose a target company")}
                ${item(c.hasCustomizations, "Generate your first application")}
            </ul>
            ${allDone
                ? paragraph(`Just one click left.`)
                : paragraph(`<strong style="color: #ffffff;">Your next step:</strong> ${escapeHtml(nextStep.label)}.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button(allDone ? "Review my email →" : nextStep.label + " →", nextStep.url)}
            </div>
            ${tipBox(`<strong style="color: #8b5cf6;">Why finish the setup:</strong> among CandidAI users, roughly one in two junior candidates secured at least one call in their first month. Your profile and target company are the evidence CandidAI needs to choose the right person and write a specific message. Results vary by profile, market, and execution.`)}
            ${paragraph(`If a step is unclear, reply and tell me where you stopped. I read the replies personally.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Thanks,<br>Alessio</p>
        `, {
            preheader: allDone
                ? "Your email is generated and waiting for review."
                : `Your saved onboarding can continue from: ${nextStep.label}.`,
            badge: allDone ? "READY TO SEND" : "QUICK CHECK-IN",
            unsubscribeUrl,
        }),
    };
}

// ── Stage 2: feature_tip (day 3) ──────────────────────────────────────────
function renderFeatureTip(firstName: string, unsubscribeUrl: string) {
    return {
        subject: firstName ? `${firstName}, three controls behind every CandidAI campaign` : "Three controls behind every CandidAI campaign",
        html: wrapEmail(`
            ${heading(firstName ? `The result is generated, but you keep control, ${escapeHtml(firstName)}.` : "The result is generated, but you keep control.")}
            ${paragraph(`<strong style="color:#ffffff;">Recruiter strategy:</strong> Pro and Ultra let you decide which shared signals matter—country, university, previous companies, role, seniority, and more.`)}
            ${paragraph(`<strong style="color:#ffffff;">Message direction:</strong> custom instructions tell CandidAI which achievements, tone, or constraints should appear across the campaign.`)}
            ${paragraph(`<strong style="color:#ffffff;">Per-company control:</strong> Ultra lets you review enriched company data and override both strategy and writing instructions for an individual company before generation.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("Open my dashboard →", `${DOMAIN}/dashboard`)}
            </div>
            ${tipBox(`<strong style="color: #8b5cf6;">The practical difference:</strong> CandidAI users received their first recruiter response in under 48 hours on average, compared with one to two weeks when a traditional application received a response at all. Results are not guaranteed.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Cheers,<br>Alessio</p>
        `, { preheader: "Recruiter criteria, message direction, and per-company overrides explained.", badge: "CAMPAIGN CONTROLS", unsubscribeUrl }),
    };
}

// ── Stage 3: case_study (day 7) ────────────────────────────────────────────
function renderCaseStudy(firstName: string, unsubscribeUrl: string) {
    return {
        subject: firstName
            ? `${firstName}, 40 ignored applications—then 3 calls in one month`
            : "40 ignored applications—then 3 calls in one month",
        html: wrapEmail(`
            ${heading("Sanne changed the channel—not her CV")}
            ${paragraph(`<strong style="color:#ffffff;">Sanne, 24</strong>, graduated in Business from the University of Groningen. She had a solid profile and one internship at a small company, but no headline employer on her CV.`)}
            ${paragraph(`After roughly 40 applications through LinkedIn and company portals, she had received three automated rejections and no human reply. Her profile was entering an ATS alongside hundreds of others without reaching a relevant person.`)}
            <div style="border-left:3px solid #8b5cf6;padding:4px 0 4px 18px;margin:24px 0;color:#d1d5db;font-size:15px;line-height:1.7;font-style:italic;">“I didn't even know whether anyone was reading them.”</div>
            ${paragraph(`Sanne selected eight European fintech and consumer companies she genuinely wanted—including N26, Adyen, Bolt, and Oatly. For each target, CandidAI identified a relevant recruiter, found a defensible connection, and built an individual email around one concrete result from her internship: an Excel model that cut a monthly reporting process by 60%.`)}

            <div style="background:linear-gradient(135deg,rgba(139,92,246,.15),rgba(124,58,237,.07));border:1px solid rgba(139,92,246,.35);border-radius:14px;padding:22px;margin:26px 0;">
              <p style="color:#a78bfa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;margin:0 0 14px;">Results in approximately four weeks</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="padding:7px 0;color:#aaa;font-size:14px;">Targeted emails</td><td style="text-align:right;color:#fff;font-size:18px;font-weight:700;">8</td></tr>
                <tr><td style="padding:7px 0;color:#aaa;font-size:14px;">Human replies</td><td style="text-align:right;color:#fff;font-size:18px;font-weight:700;">5</td></tr>
                <tr><td style="padding:7px 0;color:#aaa;font-size:14px;">Introductory calls</td><td style="text-align:right;color:#fff;font-size:18px;font-weight:700;">3</td></tr>
                <tr><td style="padding:7px 0;color:#aaa;font-size:14px;">Interview processes</td><td style="text-align:right;color:#fff;font-size:18px;font-weight:700;">2</td></tr>
                <tr><td style="padding:7px 0;color:#aaa;font-size:14px;">Offers</td><td style="text-align:right;color:#a78bfa;font-size:18px;font-weight:700;">1</td></tr>
              </table>
            </div>

            <div style="border-left:3px solid #8b5cf6;padding:4px 0 4px 18px;margin:24px 0;color:#d1d5db;font-size:15px;line-height:1.7;font-style:italic;">“The difference was speaking to a person instead of shouting into the void. Three recruiters replied within 48 hours. I signed with a fintech I didn't even know hired junior candidates.”</div>
            ${tipBox(`<strong style="color:#8b5cf6;">Why it worked:</strong> low volume and high precision; a relevant recruiter instead of a generic inbox; and specific evidence instead of “Dear [Name]” personalization. Eight targeted emails created more conversations than forty blind applications.`)}
            ${paragraph(`CandidAI did not turn Sanne into a different candidate. It made the value already in her profile visible to the right people.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("Build my targeted campaign →", `${DOMAIN}/dashboard`)}
            </div>
            <p style="color:#666;font-size:11px;line-height:1.5;margin:0 0 18px;">Individual customer outcome. Results vary by profile, market, target companies, message quality, and follow-through.</p>
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Talk soon,<br>Alessio</p>
        `, {
            preheader: "Eight targeted emails led to five human replies, three calls, and one offer.",
            badge: "REAL CUSTOMER STORY",
            unsubscribeUrl,
        }),
    };
}

// ── Stage 4: upgrade_offer (day 14) ────────────────────────────────────────
function renderUpgradeOffer(firstName: string, unsubscribeUrl: string) {
    // The query parameter is captured by middleware and pre-applied at checkout.
    const ctaUrl = `${DOMAIN}/dashboard/plan-and-credits?discount=WELCOME15`;
    return {
        subject: firstName ? `${firstName}, 15% off if you want to expand your campaign` : "15% off if you want to expand your campaign",
        html: wrapEmail(`
            ${heading("Turn the preview into a campaign")}
            ${paragraph(`Your free application showed the core process: understand the candidate, search progressively for the strongest recruiter match, and write around the evidence that connects you to the company.`)}
            ${paragraph(`A paid plan repeats that process across your target list and includes the recruiter's verified email. If that is useful for your search, this code reduces any plan by 15%:`)}
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: rgba(139, 92, 246, 0.15); border: 1px dashed rgba(139, 92, 246, 0.5); padding: 14px 28px; border-radius: 10px;">
                    <code style="color: #c4b5fd; font-size: 20px; font-weight: 700; letter-spacing: 2px; font-family: 'SF Mono', Menlo, monospace;">WELCOME15</code>
                </div>
            </div>
            ${paragraph(`<strong style="color: #ffffff;">15% off any plan.</strong> The link below applies the code automatically, and you can compare every included feature before purchasing.`)}
            ${tipBox(`<strong style="color:#8b5cf6;">Results from CandidAI users:</strong> targeted outreach produced about a 40% reply rate versus roughly 2% for their previous traditional applications—around 20× more replies. Individual results vary.`)}
            <div style="text-align: center; margin: 32px 0;">
                ${button("See plans (code pre-applied) →", ctaUrl)}
            </div>
            ${paragraph(`If you have questions about which plan fits your case, just reply to this email.`)}
            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">Cheers,<br>Alessio</p>
        `, { preheader: "WELCOME15 gives you 15% off any CandidAI plan.", badge: "MEMBER OFFER", unsubscribeUrl }),
    };
}
