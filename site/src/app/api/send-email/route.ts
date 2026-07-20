import { Resend } from "resend";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { wrapEmail, button, tipBox, heading, paragraph, escapeHtml } from "@/lib/email-template";
import { buildVerifyUrl } from "@/lib/verify-token";

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
    try {
        const { userId, type, data = {} } = await req.json();

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

        const getEmailTemplate = (type, data: any = {}) => {
            const { userRecord = {}, newData = [] } = data;
            const userId = userRecord.uid
            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://candidai.com';

            switch (type) {
                case "welcome": {
                    const subject = "🚀 Welcome to CandidAI – Let's Get You Hired!";
                    const html = wrapEmail(`
        ${heading(`Hey ${esc(userRecord.displayName || 'there')}! 👋`)}
        ${paragraph(`Welcome to <strong style="color: #8b5cf6;">CandidAI</strong> – where AI meets opportunity! We're thrilled to have you join thousands of professionals who are landing their dream jobs with personalized outreach.`)}
        ${tipBox(`<strong style="color: #8b5cf6;">💡 Did you know?</strong> Personalized emails to recruiters have a <strong>5x higher response rate</strong> than standard applications. You're already ahead of the game!`)}
        ${paragraph(`Before you start generating those game-changing emails, please verify your account:`)}
        <div style="text-align: center; margin: 32px 0;">
          ${button('Verify My Account', buildVerifyUrl(userId))}
        </div>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">What's next?</strong><br>
            Once verified, you'll complete your profile, select target companies, and let our AI craft perfectly personalized emails to the right recruiters.
          </p>
        </div>
      `, { preheader: "Complete your CandidAI verification and start your journey to landing interviews", badge: "WELCOME ABOARD" });
                    return { subject, html };
                }

                case "password-reset": {
                    if (!data.resetLink) throw new Error("no reset link")
                    email = data.email
                    const resetSubject = "🔒 Reset Your CandidAI Password";
                    const resetHtml = wrapEmail(`
        ${heading("Reset Your Password")}
        ${paragraph(`We received a request to reset the password for your CandidAI account. No worries – it happens to the best of us!`)}
        ${tipBox(`<strong style="color: #8b5cf6;">🔐 Security Note:</strong> This link will expire in 24 hours for your protection. If you didn't request this reset, you can safely ignore this email.`)}
        <div style="text-align: center; margin: 32px 0;">
          ${button('Reset My Password', `${data.resetLink}`)}
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
                    const generatedSubject = `✨ ${companiesCount} ${companiesCount === 1 ? 'Company is' : 'Companies are'} Ready for Outreach!`;

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
        ${heading(`Your Emails Are Ready, ${esc(userRecord.displayName || 'there')}! 🎉`)}
        ${paragraph(`Great news! We've crafted ${companiesCount} personalized ${companiesCount === 1 ? 'email' : 'emails'} tailored to your target ${companiesCount === 1 ? 'company' : 'companies'}. Each one is uniquely designed to catch the recruiter's attention and showcase your strengths.`)}

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
          ${button('View & Send Emails', `${domain}/dashboard`)}
        </div>

        ${tipBox(`<strong style="color: #8b5cf6;">💼 Pro Tip:</strong> Send your emails during business hours (Tuesday-Thursday, 10 AM - 2 PM) for the highest response rates. You can review and customize each email before sending!`)}

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">What's next?</strong><br>
            Review your personalized emails, make any final tweaks, and start sending! Remember to mark each as "sent" in your dashboard to track your outreach progress.
          </p>
        </div>
      `, { preheader: `${companiesCount} personalized emails ready for your review`, badge: "EMAILS READY" });

                    return { subject: generatedSubject, html: generatedHtml };

                case "first_email_generated": {
                    const firstItem = newData[0] || {};
                    const firstSubject = `🎉 Your first AI-crafted email is ready — check it out!`;

                    const firstHtml = wrapEmail(`
        ${heading(`It's done, ${esc(userRecord.displayName || 'there')}. Your first personalized email is ready. 🎉`)}
        ${paragraph(`Our AI has researched the recruiter at <strong style="color: #ffffff;">${esc(firstItem.company?.name || 'your target company')}</strong> and crafted a personalized email just for you. No templates, no copy-paste — written from scratch based on the company's news and the recruiter's background.`)}

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
          ${button('Review & Send My Email', `${domain}/dashboard`)}
        </div>

        ${tipBox(`💡 <strong style="color: #8b5cf6;">Like what you see?</strong> Upgrade your plan and run a full campaign — up to 100 companies, each with a fully personalized email crafted by AI.`)}

        <div style="padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.15);">
          <p style="color: #888888; font-size: 13px; line-height: 1.6; margin: 0;">
            Questions? We're at <a href="mailto:hello@candidai.tech" style="color: #8b5cf6; text-decoration: none;">hello@candidai.tech</a> — we actually read every message.
          </p>
        </div>
      `, { preheader: "Your first AI-crafted recruiter email is ready to review and send", badge: "YOUR FIRST EMAIL IS READY" });

                    return { subject: firstSubject, html: firstHtml };
                }

                case "purchase-confirmation": {
                    const confirmSubject = `✅ Purchase Confirmed – ${data.item}`;
                    const confirmHtml = wrapEmail(`
        ${heading("Payment Successful! 🎉")}
        ${paragraph(`Thank you for your purchase. Your account has been updated and you're ready to keep going!`)}

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
          ${button('Go to Dashboard', `${domain}/dashboard`)}
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
                    const contactSubject = `We received your message - CandidAI Support`;
                    const safeMessage = (data.message || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const contactHtml = wrapEmail(`
        ${heading(`We got your message, ${esc(data.name)}! 👋`)}
        ${paragraph(`Thanks for reaching out. Our team will review your request and get back to you as soon as possible.`)}

        ${tipBox(`<strong style="color: #8b5cf6;">📬 What's next?</strong> You'll hear back from us at <strong>hello@candidai.tech</strong>, keep an eye on your inbox (and spam folder, just in case).`)}

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
                            badge: "🎁 FREE TRIAL ACTIVE",
                            subject: `🎁 You're in, ${name}! Your first AI-crafted recruiter email is on its way`,
                            preheader: "Your CandidAI free trial is live: one company, one shot, fully AI-personalized.",
                            headline: `You're in, ${name}! Let's make your first move count.`,
                            intro: `Thank you for completing your onboarding! Your free trial is now active. We've set up everything for <strong style="color: #8b5cf6;">1 target company</strong>, our AI will research the right recruiter and craft a fully personalized email just for you. No templates, no generic messages.`,
                            perks: [
                                "1 company: AI researches the recruiter for you",
                                "Fully personalized email (not a template)",
                                "Ready to review and send from your dashboard",
                            ],
                            nextSteps: "Your email will be ready in your dashboard shortly. Review it, make any tweaks you like, and hit send. If you love the results, upgrading to a paid plan takes seconds.",
                            tip: "💡 <strong style=\"color: #8b5cf6;\">Pro tip:</strong> Personalized cold emails to recruiters get up to <strong>5× more replies</strong> than standard applications. You're already ahead.",
                        },
                        base: {
                            badge: "🎯 BASE PLAN ACTIVE",
                            subject: `🎯 Onboarding complete! Your 20-company outreach campaign is launching`,
                            preheader: "CandidAI Base is live: up to 20 personalized recruiter emails, all AI-crafted.",
                            headline: `Your campaign is launching, ${name}!`,
                            intro: `Thank you for choosing CandidAI Base! You've unlocked a full outreach campaign, our AI will research recruiters across <strong style="color: #8b5cf6;">up to 20 target companies</strong> and write a unique, personalized email for each one. No copy-paste. Every email tailored to the specific company and recruiter.`,
                            perks: [
                                "Up to 20 companies: a real outreach campaign",
                                "Individual recruiter research for each company",
                                "Fully personalized emails, not templates",
                                "Review and send from your dashboard at your pace",
                            ],
                            nextSteps: "Your emails will appear in the dashboard as they're generated, you don't have to wait for all of them. Review each one, customize if needed, and start sending. The sooner you send, the sooner you hear back.",
                            tip: "💡 <strong style=\"color: #8b5cf6;\">Send tip:</strong> Tuesday–Thursday, 10 AM–2 PM in the recruiter's timezone = highest open rates. Your dashboard shows each recruiter's company location to help you time it perfectly.",
                        },
                        pro: {
                            badge: "🚀 PRO PLAN ACTIVE",
                            subject: `🚀 You're on Pro, ${name} - your AI-powered job search just shifted into high gear`,
                            preheader: "50 companies, custom recruiter strategy, follow-up automation. Let's get you hired.",
                            headline: `High gear, ${name}. Let's get you hired.`,
                            intro: `Welcome to CandidAI Pro, where serious job seekers get serious results. You now have everything you need to run a professional, high-volume outreach campaign. Our AI will craft <strong style="color: #8b5cf6;">up to 50 personalized emails</strong>, using your custom recruiter strategy and writing instructions to make every message feel like it was written personally by you.`,
                            perks: [
                                "Up to 50 companies: a high-volume campaign",
                                "Custom recruiter search strategy with up to 30 criteria",
                                "Custom writing instructions: your voice, your style",
                                "Follow-up email automation: never miss a reply",
                                "1,000 credits for regenerations and refinements",
                            ],
                            nextSteps: "Your emails are being generated now. Head to your dashboard to track progress, review drafts as they come in, and fine-tune any message with your custom instructions. Use your credits to regenerate emails that don't feel quite right.",
                            tip: "⚡ <strong style=\"color: #8b5cf6;\">Power move:</strong> Use your <strong>custom instructions</strong> to inject your unique selling points: specific projects, metrics, or achievements you want every email to highlight. The more specific, the better the results.",
                        },
                        ultra: {
                            badge: "👑 ULTRA PLAN ACTIVE",
                            subject: `👑 Welcome to Ultra, ${name} - every advantage, fully unlocked`,
                            preheader: "100 companies, AI recommendations, deep-dive research, priority generation. You're in the fast lane.",
                            headline: `Every advantage, fully unlocked. Welcome to Ultra, ${name}.`,
                            intro: `You've chosen the most powerful job search tool available. CandidAI Ultra puts you at the front of every queue, with priority email generation, AI-powered company recommendations, deep-dive research reports, and a dedicated outreach pipeline covering <strong style="color: #8b5cf6;">up to 100 companies</strong>. This isn't just job searching. It's a coordinated campaign.`,
                            perks: [
                                "Up to 100 companies: maximum coverage",
                                "Priority generation queue: your emails go first",
                                "AI company recommendations: we find targets you haven't thought of",
                                "Deep-dive company research reports per company",
                                "Company confirmation calls: verify before you commit",
                                "Custom recruiter strategy with up to 50 criteria",
                                "Follow-up email automation",
                                "2,500 credits included",
                            ],
                            nextSteps: "Your campaign is being built right now with priority processing. You'll also see AI-recommended companies in your dashboard, these are targets our AI thinks are a strong fit based on your profile. Confirm or skip each one. Your emails will be ready faster than any other plan.",
                            tip: "👑 <strong style=\"color: #8b5cf6;\">Ultra advantage:</strong> Check your <strong>AI recommendations</strong> first - users who include AI-suggested companies report significantly more interview callbacks than those who rely on manual selection alone.",
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
          ${button('Open My Dashboard', `${domain}/dashboard`)}
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
                        subject: `Your first application for ${company} is ready`,
                        html: wrapEmail(`
                          ${heading(`Your first application is ready, ${esc(name)}.`)}
                          ${paragraph(`CandidAI researched <strong>${company}</strong>, selected <strong>${recruiter}</strong>, and completed your personalized email.`)}
                          ${button('Review my application', `${domain}/dashboard`)}
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
        });

        return NextResponse.json({ success: true, result });

    } catch (err) {
        console.error("Email API Error:", err);
        return NextResponse.json(
            { error: "Internal Server Error", detail: err.message },
            { status: 500 }
        );
    }
}
