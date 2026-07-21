import { Resend } from "resend";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { wrapEmail, button, tipBox, heading, paragraph, escapeHtml } from "@/lib/email-template";
import { buildVerifyUrl } from "@/lib/verify-token";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { analyticsDay, metricKey } from "@/lib/analytics-aggregates";
import {
    completeCommunication,
    failCommunication,
    reserveCommunication,
    type CommunicationCategory,
} from "@/lib/communication-service";

// Null-safe HTML escaper for values that originate from scraping / PDL / AI /
// user input (company names, recruiter names, article titles, email previews,
// display names). Prevents HTML/attribute injection into transactional emails.
const esc = (v: unknown) => escapeHtml(String(v ?? ""));

const resend = new Resend(process.env.RESEND_API_KEY);

// Server-to-server only. This route can send arbitrary templated mail (welcome,
// password-reset, purchase-confirmation, …) to any user/address, so it must
// never be callable from the public internet — otherwise it becomes an
// email-bombing + phishing relay on our own domain. Every internal caller
// (API routes, server actions, the Python pipeline) passes X-Internal-Key.
function isAuthorized(req: Request): boolean {
    const key = process.env.SESSION_API_KEY;
    if (!key) return false;
    return req.headers.get("x-internal-key") === key;
}

export async function POST(req) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let reservedUserId: string | null = null;
    let reservedDedupeKey: string | null = null;
    try {
        const { userId, type, data = {}, dedupeKey: requestedDedupeKey, category: requestedCategory } = await req.json();

        const VALID_TYPES = ["welcome", "password-reset", "new_emails_generated", "first_email_generated", "purchase-confirmation", "contact-confirmation", "onboarding-complete", "onboarding-recruiter-ready"];
        const TYPES_REQUIRING_USER_ID = ["welcome", "new_emails_generated", "first_email_generated", "purchase-confirmation", "onboarding-complete", "onboarding-recruiter-ready"];

        if (!type || !VALID_TYPES.includes(type)) {
            return NextResponse.json(
                { error: "Missing or invalid type" },
                { status: 400 }
            );
        }

        if (TYPES_REQUIRING_USER_ID.includes(type) && !userId) {
            return NextResponse.json(
                { error: "Missing userId for this email type" },
                { status: 400 }
            );
        }

        const defaultCategories: Record<string, CommunicationCategory> = {
            welcome: "transactional",
            "password-reset": "transactional",
            "purchase-confirmation": "transactional",
            "contact-confirmation": "transactional",
            "onboarding-complete": "operational",
            "onboarding-recruiter-ready": "operational",
            first_email_generated: "operational",
            new_emails_generated: "operational",
        };
        const category: CommunicationCategory = ["transactional", "operational", "onboarding", "marketing"].includes(requestedCategory)
            ? requestedCategory
            : defaultCategories[type] ?? "operational";
        const defaultDedupeKeys: Record<string, string | undefined> = {
            welcome: userId ? "welcome" : undefined,
            "onboarding-complete": userId ? `onboarding-complete:${data.plan || "free_trial"}` : undefined,
            "onboarding-recruiter-ready": userId ? `preview-ready:${data.jobId || data.company || "first"}` : undefined,
            first_email_generated: userId ? "first-email-generated" : undefined,
        };
        const dedupeKey = typeof requestedDedupeKey === "string" && requestedDedupeKey
            ? requestedDedupeKey.slice(0, 180)
            : defaultDedupeKeys[type];

        // --- Get user from Firebase Auth ---
        let userRecord, email;
        if (userId) {
            userRecord = await adminAuth.getUser(userId);
            email = userRecord.email;

            if (!email) {
                return NextResponse.json(
                    { error: "User has no email" },
                    { status: 404 }
                );
            }
        }


        if (userId && dedupeKey) {
            const reservation = await reserveCommunication({
                userId,
                dedupeKey,
                type,
                category,
                metadata: { company: data.company ?? null, plan: data.plan ?? null },
            });
            if (!reservation.send) {
                return NextResponse.json({ success: true, skipped: true, reason: reservation.reason });
            }
            reservedUserId = userId;
            reservedDedupeKey = dedupeKey;
        }

        const getEmailTemplate = (type, data: any = {}) => {
            const { userRecord = {}, newData = [] } = data;
            const userId = userRecord.uid
            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://candidai.com';

            switch (type) {
                case "welcome": {
                    const subject = "Verify your email to build your first CandidAI application";
                    const html = wrapEmail(`
        ${heading(`Start with one real application, ${esc(userRecord.displayName || 'there')}.`)}
        ${paragraph(`Verify your address and CandidAI will turn your CV or LinkedIn profile into a candidate profile, ask for one target company, search progressively for the strongest recruiter match, and write your first personalized email.`)}
        ${tipBox(`<strong style="color: #8b5cf6;">What to expect:</strong> recruiter research can take a couple of minutes because CandidAI tests increasingly broad strategies until it finds a credible match. Your progress is saved throughout.`)}
        <div style="text-align: center; margin: 32px 0;">
          ${button('Verify email and begin →', buildVerifyUrl(userId))}
        </div>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            If you did not create this account, no action is required.
          </p>
        </div>
      `, { preheader: "Verify your address, build your profile, and generate one real application.", badge: "VERIFY YOUR EMAIL" });
                    return { subject, html };
                }

                case "password-reset": {
                    if (!data.resetLink) throw new Error("no reset link")
                    email = data.email
                    const resetSubject = "Reset your CandidAI password";
                    const resetHtml = wrapEmail(`
        ${heading("Choose a new password")}
        ${paragraph(`A password reset was requested for your CandidAI account. Use the secure link below to choose a new password.`)}
        ${tipBox(`<strong style="color: #8b5cf6;">Security:</strong> the link expires in 24 hours. If you did not request it, ignore this message; your password will remain unchanged.`)}
        <div style="text-align: center; margin: 32px 0;">
          ${button('Reset password →', `${data.resetLink}`)}
        </div>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">Need help?</strong><br>
            If you're having trouble accessing your account, our support team is here to help at <a href="mailto:hello@candidai.tech" style="color: #8b5cf6; text-decoration: none;">hello@candidai.tech</a>
          </p>
        </div>
      `, { preheader: "Reset your CandidAI password securely", badge: "PASSWORD RESET" });
                    return { subject: resetSubject, html: resetHtml };
                }

                case "new_emails_generated":
                    const companiesCount = newData.length;
                    const generatedSubject = `${companiesCount} personalized ${companiesCount === 1 ? 'email is' : 'emails are'} ready to review`;

                    const companiesList = newData.map((item, index) => `
        <div style="background: rgba(139, 92, 246, 0.05); border-radius: 12px; padding: 20px; margin: ${index > 0 ? '16px' : '0'} 0;">
          <div style="display: table; width: 100%;">
            <div style="display: table-row;">
              <div style="display: table-cell; vertical-align: top; padding-right: 12px; width: 40px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 8px; overflow: hidden; position: relative; color: #ffffff; font-weight: 700; font-size: 18px; text-align: center; line-height: 40px;">
                  ${esc(item.company.name).charAt(0).toUpperCase()}
                  ${item.company.domain ? `<img src="https://logo.clearbit.com/${esc(item.company.domain)}" width="40" height="40" alt="" style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; object-fit: contain; background: white; border-radius: 8px;">` : ''}
                </div>
              </div>
              <div style="display: table-cell; vertical-align: top;">
                <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
                  ${esc(item.company.name)}
                </h3>
                <p style="color: #888888; font-size: 13px; margin: 0 0 12px;">
                  ${esc(item.company.domain)}
                </p>

                <div style="margin: 12px 0;">
                  <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 4px;">
                    <strong style="color: #8b5cf6;">👤 Recruiter:</strong> ${esc(item.recruiter.name)}
                  </p>
                  <p style="color: #888888; font-size: 13px; margin: 0;">
                    ${esc(item.recruiter.jobTitle)}
                  </p>
                </div>

                ${item.articles && item.articles.length > 0 ? `
                  <div style="margin: 12px 0;">
                    <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 8px;">
                      <strong style="color: #8b5cf6;">📰 Referenced Articles:</strong>
                    </p>
                    ${item.articles.map(article => `
                      <a href="${esc(article.link)}" style="display: block; color: #7c3aed; text-decoration: none; font-size: 13px; margin: 4px 0; padding: 4px 0;">
                        → ${esc(article.title)}
                      </a>
                    `).join('')}
                  </div>
                ` : ''}

                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 12px; margin-top: 12px;">
                  <p style="color: #cccccc; font-size: 13px; line-height: 1.5; margin: 0; font-style: italic;">
                    "${esc(item.preview.substring(0, 150))}${item.preview.length > 150 ? '...' : ''}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('');

                    const generatedHtml = wrapEmail(`
        ${heading(`Your campaign has new results, ${esc(userRecord.displayName || 'there')}.`)}
        ${paragraph(`CandidAI completed ${companiesCount} ${companiesCount === 1 ? 'company' : 'companies'}: recruiter research, company context, and an individually generated message are ready for your review.`)}

        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%); border: 2px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="color: #8b5cf6; font-size: 36px; font-weight: 700; margin: 0 0 8px;">${companiesCount}</p>
          <p style="color: #cccccc; font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
            Personalized ${companiesCount === 1 ? 'Email' : 'Emails'} Generated
          </p>
        </div>

        <h3 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 32px 0 20px;">
          📧 Your Target ${companiesCount === 1 ? 'Company' : 'Companies'}:
        </h3>

        ${companiesList}

        <div style="text-align: center; margin: 40px 0 32px;">
          ${button('Review campaign results →', `${domain}/dashboard`)}
        </div>

        ${tipBox(`<strong style="color: #8b5cf6;">Before sending:</strong> verify that the recruiter is the person you want to contact and that every claim in the draft reflects your experience. You can edit the message without losing the generated version.`)}

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">What's next?</strong><br>
            Open each result, review the research and draft, make any final edits, then mark it as sent so the dashboard can track campaign progress.
          </p>
        </div>
      `, { preheader: `${companiesCount} personalized emails ready for your review`, badge: "EMAILS READY" });

                    return { subject: generatedSubject, html: generatedHtml };

                case "first_email_generated": {
                    const firstItem = newData[0] || {};
                    const firstSubject = `Your first application for ${esc(firstItem.company?.name || 'your target company')} is ready`;

                    const firstHtml = wrapEmail(`
        ${heading(`Your first application is ready, ${esc(userRecord.displayName || 'there')}.`)}
        ${paragraph(`CandidAI searched for the strongest recruiter match at <strong style="color: #ffffff;">${esc(firstItem.company?.name || 'your target company')}</strong> and generated a message from your candidate profile and the available company and recruiter context.`)}
        ${tipBox(`<strong style="color:#8b5cf6;">Why targeted outreach matters:</strong> among early beta testers, CandidAI emails received replies at roughly 40% versus about 2% for their previous traditional applications. Early sample; results vary.`)}

        <div style="background: rgba(139, 92, 246, 0.05); border-radius: 12px; padding: 20px; margin: 0 0 28px;">
          <div style="display: table; width: 100%;">
            <div style="display: table-row;">
              <div style="display: table-cell; vertical-align: top; padding-right: 14px; width: 44px;">
                <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; overflow: hidden; position: relative; color: #ffffff; font-weight: 700; font-size: 20px; text-align: center; line-height: 44px;">
                  ${esc(firstItem.company?.name || '?').charAt(0).toUpperCase() || '?'}
                  ${firstItem.company?.domain ? `<img src="https://logo.clearbit.com/${esc(firstItem.company.domain)}" width="44" height="44" alt="" style="position: absolute; top: 0; left: 0; width: 44px; height: 44px; object-fit: contain; background: white; border-radius: 10px;">` : ''}
                </div>
              </div>
              <div style="display: table-cell; vertical-align: top;">
                <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
                  ${esc(firstItem.company?.name || '')}
                </h3>
                <p style="color: #888888; font-size: 13px; margin: 0 0 10px;">${esc(firstItem.company?.domain || '')}</p>
                ${firstItem.recruiter?.name ? `
                <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 4px;">
                  <strong style="color: #8b5cf6;">👤 Recruiter:</strong> ${esc(firstItem.recruiter.name)}
                </p>
                <p style="color: #888888; font-size: 13px; margin: 0 0 12px;">${esc(firstItem.recruiter.jobTitle || '')}</p>
                ` : ''}
                ${firstItem.articles && firstItem.articles.length > 0 ? `
                <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 6px;">
                  <strong style="color: #8b5cf6;">📰 Referenced:</strong>
                </p>
                ${firstItem.articles.map((a: any) => `
                  <a href="${esc(a.link)}" style="display: block; color: #7c3aed; text-decoration: none; font-size: 13px; margin: 3px 0;">→ ${esc(a.title)}</a>
                `).join('')}
                ` : ''}
              </div>
            </div>
          </div>

          ${firstItem.preview ? `
          <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 14px; margin-top: 16px;">
            <p style="color: #aaaaaa; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Email preview</p>
            <p style="color: #cccccc; font-size: 13px; line-height: 1.6; margin: 0; font-style: italic;">
              "${esc(firstItem.preview.substring(0, 180))}${firstItem.preview.length > 180 ? '...' : ''}"
            </p>
          </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin: 0 0 28px;">
          ${button('Review recruiter and email →', `${domain}/dashboard`)}
        </div>

        ${tipBox(`<strong style="color: #8b5cf6;">What the preview excludes:</strong> to keep this first generation fast, it does not include the deeper company-blog research used in definitive campaigns, and the free result does not reveal the recruiter's direct email. Paid campaigns regenerate from your final settings and include the verified address when available.`)}

        <div style="padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.15);">
          <p style="color: #888888; font-size: 13px; line-height: 1.6; margin: 0;">
            Questions? We're at <a href="mailto:hello@candidai.tech" style="color: #8b5cf6; text-decoration: none;">hello@candidai.tech</a> — we actually read every message.
          </p>
        </div>
      `, { preheader: "Your first AI-crafted recruiter email is ready to review and send", badge: "YOUR FIRST EMAIL IS READY" });

                    return { subject: firstSubject, html: firstHtml };
                }

                case "purchase-confirmation": {
                    const confirmSubject = `Payment confirmed: ${data.item}`;
                    const confirmHtml = wrapEmail(`
        ${heading("Your purchase is confirmed")}
        ${paragraph(`Your CandidAI account has been updated. The details below match the completed payment.`)}

        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%); border: 2px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.2);">
                <span style="color: #888888; font-size: 14px;">Item</span>
              </td>
              <td style="padding: 10px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.2); text-align: right;">
                <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${data.item}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.2);">
                <span style="color: #888888; font-size: 14px;">Amount Paid</span>
              </td>
              <td style="padding: 10px 0; border-bottom: 1px solid rgba(139, 92, 246, 0.2); text-align: right;">
                <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">${data.amount}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0;">
                <span style="color: #888888; font-size: 14px;">New Credit Balance</span>
              </td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${data.newBalance} credits</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          ${button('Continue in CandidAI →', `${domain}/dashboard`)}
          ${data.receiptUrl ? button('View Receipt', data.receiptUrl, false) : ''}
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">Questions?</strong><br>
            If you have any questions about your purchase, contact us at <a href="mailto:hello@candidai.tech" style="color: #8b5cf6; text-decoration: none;">hello@candidai.tech</a>
          </p>
        </div>
      `, { preheader: `Your purchase of ${data.item} for ${data.amount} is confirmed`, badge: "PURCHASE CONFIRMED" });
                    return { subject: confirmSubject, html: confirmHtml };
                }

                case "contact-confirmation": {
                    email = data.email;
                    const contactSubject = `We received your CandidAI support request`;
                    const safeMessage = (data.message || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const contactHtml = wrapEmail(`
        ${heading(`Your message is in the queue, ${esc(data.name)}.`)}
        ${paragraph(`We saved the request below and will reply to the address you provided.`)}

        ${tipBox(`<strong style="color: #8b5cf6;">What happens next:</strong> a reply will come from <strong>hello@candidai.tech</strong>. You can keep this confirmation as a copy of your request.`)}

        <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #888888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your message</p>
          <p style="margin: 0 0 4px; color: #a78bfa; font-size: 13px; font-weight: 600;">${esc(data.subject)}</p>
          <p style="margin: 8px 0 0; color: #d1d5db; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            This is an automated confirmation, please do not reply to this email.
          </p>
        </div>
      `, { preheader: "We've received your support request and will be in touch soon", badge: "MESSAGE RECEIVED" });
                    return { subject: contactSubject, html: contactHtml };
                }

                case "onboarding-complete": {
                    const plan = data.plan || "free_trial";
                    const name = userRecord.displayName || 'there';

                    type PlanContent = {
                        badge: string;
                        subject: string;
                        preheader: string;
                        headline: string;
                        intro: string;
                        perks: string[];
                        nextSteps: string;
                        tip: string;
                    };

                    const planContent: Record<string, PlanContent> = {
                        free_trial: {
                            badge: "FREE APPLICATION COMPLETE",
                            subject: `${name}, your first CandidAI application is saved`,
                            preheader: "Your recruiter match and first personalized application are saved in the dashboard.",
                            headline: `Your first application is complete, ${name}.`,
                            intro: `CandidAI has completed the free process for <strong style="color: #8b5cf6;">one target company</strong>: candidate analysis, progressive recruiter search, recruiter selection, and a personalized draft. The result is saved in your dashboard.`,
                            perks: [
                                "One completed recruiter search",
                                "Recruiter profile, LinkedIn link, and match rationale",
                                "One personalized draft ready to copy or open",
                            ],
                            nextSteps: "Review the recruiter and draft in your dashboard. The free result does not reveal the direct email address or include the deeper blog research used for definitive paid generation.",
                            tip: "<strong style=\"color: #8b5cf6;\">The beta pattern:</strong> roughly one in two junior beta users secured at least one call in their first month. A paid plan reruns generation from your final settings, includes verified recruiter email data when available, and covers 20, 50, or 100 companies. Early sample; results vary.",
                        },
                        base: {
                            badge: "BASE CAMPAIGN LAUNCHED",
                            subject: `${name}, your 20-company CandidAI campaign is underway`,
                            preheader: "Recruiter research and definitive email generation have started for your Base campaign.",
                            headline: `Your definitive campaign is underway, ${name}.`,
                            intro: `You confirmed the campaign direction. CandidAI will now research recruiters across <strong style="color: #8b5cf6;">up to 20 target companies</strong>, retrieve direct recruiter email data when available, and generate an individual message for each result.`,
                            perks: [
                                "Up to 20 target companies",
                                "Recruiter research for every company",
                                "Verified recruiter email included when available",
                                "Individual drafts with version history",
                            ],
                            nextSteps: "Results appear in the dashboard as companies complete. Review the selected recruiter and message before sending; you do not need to wait for the entire campaign.",
                            tip: "<strong style=\"color: #8b5cf6;\">A real beta result:</strong> after about 40 ignored portal applications, Sanne sent eight targeted CandidAI emails and received five human replies, three calls, two interview processes, and one offer in roughly four weeks. Individual results vary.",
                        },
                        pro: {
                            badge: "PRO CAMPAIGN LAUNCHED",
                            subject: `${name}, your Pro campaign is now using your strategy`,
                            preheader: "Up to 50 companies, custom recruiter criteria, writing instructions, follow-ups, and 1,000 credits.",
                            headline: `Your strategy is now becoming a campaign, ${name}.`,
                            intro: `CandidAI is applying the recruiter criteria and writing direction you confirmed across <strong style="color: #8b5cf6;">up to 50 target companies</strong>. Each company receives its own recruiter search and definitive email generation.`,
                            perks: [
                                "Up to 50 target companies",
                                "Custom recruiter strategy with up to 30 criteria",
                                "Campaign-wide custom writing instructions",
                                "Follow-up email automation",
                                "1,000 credits for regenerations and refinements",
                            ],
                            nextSteps: "Track completed companies in the dashboard and inspect each recruiter, research context, and draft. Credits remain available for targeted regeneration and refinements after the initial run.",
                            tip: "<strong style=\"color: #8b5cf6;\">Keep instructions concrete:</strong> Sanne's strongest hook was not a famous employer—it was a measurable internship result: an Excel model that cut monthly reporting time by 60%. Named projects and outcomes give generation evidence a recruiter can remember.",
                        },
                        ultra: {
                            badge: "ULTRA CAMPAIGN LAUNCHED",
                            subject: `${name}, your Ultra campaign entered the priority pipeline`,
                            preheader: "Up to 100 companies with enriched company data, per-company controls, recommendations, and priority generation.",
                            headline: `Your most detailed campaign is now underway, ${name}.`,
                            intro: `CandidAI Ultra is processing <strong style="color: #8b5cf6;">up to 100 companies</strong> through the priority pipeline, using enriched company information, your campaign strategy, and any company-specific overrides you confirmed.`,
                            perks: [
                                "Up to 100 target companies",
                                "Priority generation queue",
                                "AI-assisted company recommendations",
                                "Detailed company data before generation",
                                "Confirm or replace each enriched company before spending a generation",
                                "Per-company recruiter strategy and writing instructions",
                                "Custom recruiter strategy with up to 50 criteria",
                                "Follow-up email automation",
                                "2,500 credits included",
                            ],
                            nextSteps: "Review enriched companies before their definitive generation. If the resolved company is wrong, replace it; if one target needs a different recruiter profile or message angle, override those settings for that company alone.",
                            tip: "<strong style=\"color: #8b5cf6;\">Precision at scale:</strong> early beta users reported a first recruiter response in under 48 hours on average. Ultra keeps campaign defaults efficient while letting you intervene with company-specific strategy where a target deserves a different approach. Results vary.",
                        },
                    };

                    const content = planContent[plan] || planContent.free_trial;

                    const perksHtml = content.perks.map((perk, i) => `
          <tr>
            <td style="padding: 10px 0; ${i < content.perks.length - 1 ? 'border-bottom: 1px solid rgba(139, 92, 246, 0.1);' : ''}">
              <span style="color: #8b5cf6; font-weight: 700; margin-right: 10px;">✓</span>
              <span style="color: #cccccc; font-size: 14px;">${perk}</span>
            </td>
          </tr>`).join('');

                    const onboardingHtml = wrapEmail(`
        ${heading(content.headline)}
        ${paragraph(content.intro)}

        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 14px; padding: 24px; margin: 0 0 28px;">
          <p style="color: #8b5cf6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px;">What you have access to</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${perksHtml}
          </table>
        </div>

        <div style="background: rgba(255, 255, 255, 0.04); border-radius: 12px; padding: 20px; margin: 0 0 28px;">
          <p style="color: #aaaaaa; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px;">What happens next</p>
          <p style="color: #cccccc; font-size: 14px; line-height: 1.7; margin: 0;">
            ${content.nextSteps}
          </p>
        </div>

        ${tipBox(content.tip)}

        <div style="text-align: center; margin: 0 0 32px;">
                    ${button('Open campaign dashboard →', `${domain}/dashboard`)}
        </div>

        <div style="padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.15);">
          <p style="color: #888888; font-size: 13px; line-height: 1.6; margin: 0;">
            Questions or feedback? We're at <a href="mailto:hello@candidai.tech" style="color: #8b5cf6; text-decoration: none;">hello@candidai.tech</a>, we actually read every message.
          </p>
        </div>
      `, { preheader: content.preheader, badge: content.badge });

                    return { subject: content.subject, html: onboardingHtml };
                }

                case "onboarding-recruiter-ready": {
                    const name = userRecord.displayName || 'there';
                    const company = esc(data.company || 'your target company');
                    const recruiter = esc(data.recruiter || 'the selected recruiter');
                    return {
                        subject: `Your recruiter match and application for ${company} are ready`,
                        html: wrapEmail(`
                          ${heading(`The search is complete, ${esc(name)}.`)}
                          ${paragraph(`CandidAI completed the progressive recruiter search for <strong>${company}</strong>, selected <strong>${recruiter}</strong>, and generated your first personalized application.`)}
                          ${paragraph(`Early beta outreach produced roughly 20× more replies than testers' previous traditional applications. Your result is now ready for the same essential step: review the evidence, then reach the person rather than another generic inbox.`)}
                          ${tipBox(`<strong style="color:#8b5cf6;">Everything is saved:</strong> open the result to see why this recruiter was chosen, visit their LinkedIn profile, and review the complete draft.`)}
                          <div style="text-align:center;margin:32px 0;">${button('Review recruiter and application →', `${domain}/dashboard`)}</div>
                        `, { preheader: `Your personalized email for ${company} is ready`, badge: "APPLICATION READY" })
                    };
                }

                default:
                    return {
                        subject: "CandidAI Notification",
                        html: wrapEmail(
                            paragraph("You have a new notification from CandidAI."),
                            { preheader: "New notification from CandidAI" }
                        )
                    };
            }
        };

        const { subject, html } = getEmailTemplate(type, {
            userRecord,
            ...data/*: [
            {
              company: { name: 'TechCorp', domain: 'techcorp.com' },
              recruiter: { name: 'Sarah Johnson', jobTitle: 'Senior Technical Recruiter' },
              articles: [
                { title: 'Our Engineering Culture', link: 'https://techcorp.com/blog/culture' }
              ],
              preview: 'Dear Sarah, I was fascinated by your recent article...'
            }
          ]*/
        });

        if (!email)
            throw new Error("Email error")

        // --- Send email via Resend ---
        const result = await resend.emails.send({
            from: "CandidAI <no-reply@candidai.tech>",
            to: email,
            subject,
            html,
        }, userId && dedupeKey ? { idempotencyKey: `${userId}:${dedupeKey}`.slice(0, 256) } : undefined);

        if (result.error) throw new Error(JSON.stringify(result.error));
        if (userId && dedupeKey) {
            await completeCommunication({
                userId,
                dedupeKey,
                category,
                type,
                providerId: result.data?.id,
            });
        } else if (result.data?.id) {
            const batch = adminDb.batch();
            batch.set(adminDb.collection("email_provider_index").doc(result.data.id), {
                userId: userId ?? null,
                dedupeKey: dedupeKey ?? null,
                type,
                category,
                createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            batch.set(adminDb.collection("analytics_daily").doc(analyticsDay()), {
                communications_sent: FieldValue.increment(1),
                [`communications_sent_category_${metricKey(category)}`]: FieldValue.increment(1),
                [`communications_sent_type_${metricKey(type)}`]: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            await batch.commit();
        }

        return NextResponse.json({ success: true, result });

    } catch (err) {
        console.error("Email API Error:", err);
        if (reservedUserId && reservedDedupeKey) {
            await failCommunication({ userId: reservedUserId, dedupeKey: reservedDedupeKey, error: err }).catch(() => undefined);
        }
        return NextResponse.json(
            { error: "Internal Server Error", detail: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
