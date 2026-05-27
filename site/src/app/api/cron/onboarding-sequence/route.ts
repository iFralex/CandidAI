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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FROM = "Alessio (CandidAI) <no-reply@candidai.tech>";
const REPLY_TO = "hello@candidai.tech";
const DAY_MS = 86400_000;

function isAuthorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return false;
    return token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY;
}

interface StageConfig {
    key: string;                    // matches seq_<key>_sent flag on user doc
    /** Days since signup (start, end exclusive) the email is eligible to send. */
    windowDays: [number, number];
    /** Extra filter on the user doc (post-fetched, filtered in JS). */
    extraFilter?: (u: Record<string, unknown>) => boolean;
    render: (firstName: string) => { subject: string; html: string };
}

const STAGES: StageConfig[] = [
    {
        key: "welcome",
        windowDays: [1, 3],
        render: renderWelcome,
    },
    {
        key: "feature_tip",
        windowDays: [3, 5],
        render: renderFeatureTip,
    },
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

// ─── Email templates (French — audience is FR-speaking) ───────────────────

const dashboardUrl = "https://candidai.tech/dashboard";
const pricingUrl = "https://candidai.tech/dashboard/plan-and-credits";

function shellHtml(body: string): string {
    return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#222;line-height:1.55">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;border:1px solid #eee;padding:28px">
${body}
<p style="margin:28px 0 0;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px">
    Tu reçois ce message parce que tu t'es inscrit sur candidai.tech.
    Réponds &laquo; stop &raquo; pour ne plus recevoir de mails de ma part.
</p>
</div>
</body></html>`;
}

function greet(firstName: string): string {
    return firstName ? `Salut ${escapeHtml(firstName)},` : "Salut,";
}

// ── Stage 1 ─────────────────────────────────────────────────────────────────
function renderWelcome(firstName: string) {
    return {
        subject: firstName ? `${firstName}, bienvenue sur CandidAI` : "Bienvenue sur CandidAI",
        html: shellHtml(`
            <p style="margin:0 0 16px">${greet(firstName)}</p>
            <p style="margin:0 0 16px">Je suis Alessio, le créateur de CandidAI. Merci de t'être inscrit !</p>
            <p style="margin:0 0 16px">En quelques mots, CandidAI envoie pour toi des emails ultra-personnalisés à des recruteurs ciblés, sur la base de ton CV et des entreprises que tu vises. Trois étapes pour commencer :</p>
            <ol style="margin:0 0 20px;padding-left:20px;color:#444">
                <li style="margin-bottom:6px">Téléverse ton CV (PDF ou DOCX, on en extrait tout automatiquement)</li>
                <li style="margin-bottom:6px">Ajoute 1-2 entreprises où tu voudrais postuler</li>
                <li>Vérifie ton mail généré dans le dashboard — modifie-le si besoin — et clique sur &laquo; Envoyer &raquo;</li>
            </ol>
            <p style="margin:0 0 20px"><a href="${dashboardUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Continuer mon onboarding →</a></p>
            <p style="margin:0 0 16px">Si quelque chose te bloque, réponds à ce mail — j'y réponds personnellement.</p>
            <p style="margin:0;color:#777">À très vite,<br>Alessio</p>
        `),
    };
}

// ── Stage 2 ─────────────────────────────────────────────────────────────────
function renderFeatureTip(firstName: string) {
    return {
        subject: firstName ? `${firstName}, une fonctionnalité que tu n'as peut-être pas vue` : "Une fonctionnalité que tu n'as peut-être pas vue",
        html: shellHtml(`
            <p style="margin:0 0 16px">${greet(firstName)}</p>
            <p style="margin:0 0 16px">Petite astuce que beaucoup d'utilisateurs ratent : si le recruteur qu'on a trouvé ne te plaît pas, tu peux en chercher un autre en un clic depuis le dashboard.</p>
            <p style="margin:0 0 16px">Tu peux aussi modifier le ton ou le contenu de l'email avant envoi — pas besoin de le réécrire, juste ajuster quelques lignes. Et si le mail généré ne te convainc pas du tout, le bouton &laquo; régénérer &raquo; produit une version alternative.</p>
            <p style="margin:0 0 20px"><a href="${dashboardUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Aller au dashboard →</a></p>
            <p style="margin:0 0 16px">Si tu n'as pas encore essayé, c'est le bon moment.</p>
            <p style="margin:0;color:#777">À bientôt,<br>Alessio</p>
        `),
    };
}

// ── Stage 3 ─────────────────────────────────────────────────────────────────
function renderCaseStudy(firstName: string) {
    return {
        subject: firstName ? `${firstName}, comment Marie a obtenu 3 entretiens en 10 jours` : "Comment Marie a obtenu 3 entretiens en 10 jours",
        html: shellHtml(`
            <p style="margin:0 0 16px">${greet(firstName)}</p>
            <p style="margin:0 0 16px">Marie est une utilisatrice française qui visait une alternance en marketing. Elle a uploadé son CV, ciblé 5 entreprises, et envoyé les emails générés par CandidAI à des recruteurs précis chez chacune.</p>
            <p style="margin:0 0 16px">Résultat : <strong>3 réponses positives en 10 jours</strong>, dont 2 ont mené à un entretien. Aucune scroll sur LinkedIn, aucune candidature aveugle — juste 5 emails ultra-personnalisés envoyés au bon contact.</p>
            <p style="margin:0 0 16px">C'est exactement ce que le produit fait pour toi : il identifie qui contacter (pas un email générique &laquo; jobs@ &raquo;), il écrit un mail qui montre que tu connais l'entreprise, et tu n'as qu'à valider et envoyer.</p>
            <p style="margin:0 0 20px"><a href="${dashboardUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Voir mon dashboard →</a></p>
            <p style="margin:0;color:#777">À bientôt,<br>Alessio</p>
        `),
    };
}

// ── Stage 4 ─────────────────────────────────────────────────────────────────
function renderUpgradeOffer(firstName: string) {
    return {
        subject: firstName ? `${firstName}, -15% sur tous les plans (valable 7 jours)` : "-15% sur tous les plans (valable 7 jours)",
        html: shellHtml(`
            <p style="margin:0 0 16px">${greet(firstName)}</p>
            <p style="margin:0 0 16px">Tu utilises CandidAI depuis 2 semaines en version gratuite — j'espère que ça t'aide.</p>
            <p style="margin:0 0 16px">Si tu veux passer à plus d'entreprises ciblées, j'ai un code de réduction pour toi :</p>
            <p style="margin:0 0 16px;text-align:center"><code style="display:inline-block;background:#f5f0ff;color:#7c3aed;padding:10px 20px;border-radius:8px;font-size:18px;font-weight:600;letter-spacing:1px">WELCOME15</code></p>
            <p style="margin:0 0 16px"><strong>-15% sur n'importe quel plan</strong>, valable 7 jours. À utiliser au moment du checkout.</p>
            <p style="margin:0 0 20px"><a href="${pricingUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500">Voir les plans →</a></p>
            <p style="margin:0 0 16px">Si tu as des questions sur le bon plan pour ton cas, réponds à ce mail.</p>
            <p style="margin:0;color:#777">À bientôt,<br>Alessio</p>
        `),
    };
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
