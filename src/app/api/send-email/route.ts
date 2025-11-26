import { Resend } from "resend";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
    try {
        const { userId, type, newData = [] } = await req.json();

        if (!userId || !type) {
            return NextResponse.json(
                { error: "Missing userId or type" },
                { status: 400 }
            );
        }

        // --- Get user from Firebase Auth ---
        const userRecord = await adminAuth.getUser(userId);
        const email = userRecord.email;

        if (!email) {
            return NextResponse.json(
                { error: "User has no email" },
                { status: 404 }
            );
        }

        const getEmailTemplate = (type, data = {}) => {
            const { userRecord = {}, newData = [] } = data;
            const userId = userRecord.uid
            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://candidai.com';

            // Common email layout wrapper
            const wrapEmail = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>CandidAI</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f0f0f;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                CandidAI
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                Your AI-Powered Career Accelerator
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #1a1a1a; border-top: 1px solid rgba(139, 92, 246, 0.2);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <a href="${domain}" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Visit Dashboard</a>
                    <span style="color: #666666; margin: 0 12px;">•</span>
                    <a href="${domain}/help" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Help Center</a>
                    <span style="color: #666666; margin: 0 12px;">•</span>
                    <a href="${domain}/contact" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Contact Us</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; color: #888888; font-size: 12px; line-height: 18px;">
                    <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} CandidAI. All rights reserved.</p>
                    <p style="margin: 0; color: #666666;">
                      Transforming job search with AI-powered personalization
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 20px;">
                    <a href="${domain}/unsubscribe" style="color: #666666; text-decoration: underline; font-size: 11px;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

            // Button component
            const button = (text, link, isPrimary = true) => `
    <a href="${link}" style="display: inline-block; padding: 16px 32px; background: ${isPrimary ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'transparent'}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; border: ${isPrimary ? 'none' : '2px solid #8b5cf6'}; transition: all 0.3s ease; margin: 10px 0;">
      ${text}
    </a>
  `;

            switch (type) {
                case "welcome":
                    const subject = "🚀 Welcome to CandidAI – Let's Get You Hired!";
                    const html = wrapEmail(`
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px; margin-bottom: 20px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">WELCOME ABOARD</span>
          </div>
        </div>

        <h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">
          Hey ${userRecord.displayName || 'there'}! 👋
        </h2>
        
        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Welcome to <strong style="color: #8b5cf6;">CandidAI</strong> – where AI meets opportunity! We're thrilled to have you join thousands of professionals who are landing their dream jobs with personalized outreach.
        </p>

        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #8b5cf6;">💡 Did you know?</strong> Personalized emails to recruiters have a <strong>5x higher response rate</strong> than standard applications. You're already ahead of the game!
          </p>
        </div>

        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Before you start generating those game-changing emails, please verify your account:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          ${button('Verify My Account', `${domain}/verify/${userId}`)}
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">What's next?</strong><br>
            Once verified, you'll complete your profile, select target companies, and let our AI craft perfectly personalized emails to the right recruiters.
          </p>
        </div>
      `, "Complete your CandidAI verification and start your journey to landing interviews");

                    return { subject, html };

                case "password-reset":
                    const resetSubject = "🔒 Reset Your CandidAI Password";
                    const resetHtml = wrapEmail(`
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px; margin-bottom: 20px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">PASSWORD RESET</span>
          </div>
        </div>

        <h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">
          Reset Your Password
        </h2>
        
        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          We received a request to reset the password for your CandidAI account. No worries – it happens to the best of us!
        </p>

        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #8b5cf6;">🔐 Security Note:</strong> This link will expire in 24 hours for your protection. If you didn't request this reset, you can safely ignore this email.
          </p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          ${button('Reset My Password', `${domain}/change-password/${userId}`)}
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">Need help?</strong><br>
            If you're having trouble accessing your account, our support team is here to help at <a href="mailto:support@candidai.com" style="color: #8b5cf6; text-decoration: none;">support@candidai.com</a>
          </p>
        </div>
      `, "Reset your CandidAI password securely");

                    return { subject: resetSubject, html: resetHtml };

                case "new_emails_generated":
                    const companiesCount = newData.length;
                    const generatedSubject = `✨ ${companiesCount} ${companiesCount === 1 ? 'Company is' : 'Companies are'} Ready for Outreach!`;

                    const companiesList = newData.map((item, index) => `
        <div style="background: rgba(139, 92, 246, 0.05); border-radius: 12px; padding: 20px; margin: ${index > 0 ? '16px' : '0'} 0;">
          <div style="display: table; width: 100%;">
            <div style="display: table-row;">
              <div style="display: table-cell; vertical-align: top; padding-right: 12px; width: 40px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 18px;">
                  ${item.company.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div style="display: table-cell; vertical-align: top;">
                <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 4px;">
                  ${item.company.name}
                </h3>
                <p style="color: #888888; font-size: 13px; margin: 0 0 12px;">
                  ${item.company.domain}
                </p>
                
                <div style="margin: 12px 0;">
                  <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 4px;">
                    <strong style="color: #8b5cf6;">👤 Recruiter:</strong> ${item.recruiter.name}
                  </p>
                  <p style="color: #888888; font-size: 13px; margin: 0;">
                    ${item.recruiter.jobTitle}
                  </p>
                </div>

                ${item.articles && item.articles.length > 0 ? `
                  <div style="margin: 12px 0;">
                    <p style="color: #aaaaaa; font-size: 14px; margin: 0 0 8px;">
                      <strong style="color: #8b5cf6;">📰 Referenced Articles:</strong>
                    </p>
                    ${item.articles.map(article => `
                      <a href="${article.link}" style="display: block; color: #7c3aed; text-decoration: none; font-size: 13px; margin: 4px 0; padding: 4px 0;">
                        → ${article.title}
                      </a>
                    `).join('')}
                  </div>
                ` : ''}

                <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 12px; margin-top: 12px;">
                  <p style="color: #cccccc; font-size: 13px; line-height: 1.5; margin: 0; font-style: italic;">
                    "${item.preview.substring(0, 150)}${item.preview.length > 150 ? '...' : ''}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('');

                    const generatedHtml = wrapEmail(`
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px; margin-bottom: 20px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">EMAILS READY</span>
          </div>
        </div>

        <h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">
          Your Emails Are Ready, ${userRecord.displayName || 'there'}! 🎉
        </h2>
        
        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Great news! We've crafted ${companiesCount} personalized ${companiesCount === 1 ? 'email' : 'emails'} tailored to your target ${companiesCount === 1 ? 'company' : 'companies'}. Each one is uniquely designed to catch the recruiter's attention and showcase your strengths.
        </p>

        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%); border: 2px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="color: #8b5cf6; font-size: 36px; font-weight: 700; margin: 0 0 8px;">
            ${companiesCount}
          </p>
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

        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #8b5cf6;">💼 Pro Tip:</strong> Send your emails during business hours (Tuesday-Thursday, 10 AM - 2 PM) for the highest response rates. You can review and customize each email before sending!
          </p>
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #aaaaaa;">What's next?</strong><br>
            Review your personalized emails, make any final tweaks, and start sending! Remember to mark each as "sent" in your dashboard to track your outreach progress.
          </p>
        </div>
      `, `${companiesCount} personalized emails ready for your review`);

                    return { subject: generatedSubject, html: generatedHtml };

                default:
                    return {
                        subject: "CandidAI Notification",
                        html: wrapEmail(`
          <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0;">
            You have a new notification from CandidAI.
          </p>
        `, "New notification from CandidAI")
                    };
            }
        };

        const { subject, html } = getEmailTemplate(type, {
            userRecord,
            newData/*: [
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
