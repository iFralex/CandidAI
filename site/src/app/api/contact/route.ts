import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://candidai.tech';

const wrapEmail = (content: string, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>CandidAI</title>
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
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
                    <a href="${domain}/dashboard" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Visit Dashboard</a>
                    <span style="color: #666666; margin: 0 12px;">•</span>
                    <a href="${domain}/dashboard/help" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Help Center</a>
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
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export async function POST(req: Request) {
    try {
        const { name, email, subject, message, userId } = await req.json();

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
        }

        const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        await Promise.all([
            // Email to support team
            resend.emails.send({
                from: "CandidAI Contact <noreply@candidai.tech>",
                to: "support@candidai.tech",
                replyTo: email,
                subject: `[Contact] ${subject} — from ${name}`,
                html: wrapEmail(`
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px; margin-bottom: 20px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">NEW CONTACT MESSAGE</span>
          </div>
        </div>

        <h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 24px; line-height: 1.3;">
          Message from ${name}
        </h2>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom: 20px;">
              <p style="margin: 0 0 4px; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">From</p>
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">${name}</p>
              <p style="margin: 4px 0 0; color: #8b5cf6; font-size: 14px;">${email}</p>
              ${userId ? `<p style="margin: 4px 0 0; color: #666666; font-size: 12px;">User ID: ${userId}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid rgba(139, 92, 246, 0.2);">
              <p style="margin: 0 0 4px; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Subject</p>
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">${subject}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 20px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
              <p style="margin: 0 0 12px; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Message</p>
              <div style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 20px;">
                <p style="margin: 0; color: #e5e7eb; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${safeMessage}</p>
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            Reply directly to this email to respond to ${name}.
          </p>
        </div>
      `, `New contact message from ${name} — ${subject}`),
            }),

            // Confirmation email to the requester
            resend.emails.send({
                from: "CandidAI Support <noreply@candidai.tech>",
                to: email,
                subject: `We received your message — CandidAI Support`,
                html: wrapEmail(`
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px; margin-bottom: 20px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">MESSAGE RECEIVED</span>
          </div>
        </div>

        <h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">
          We got your message, ${name}! 👋
        </h2>

        <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Thanks for reaching out. Our team will review your request and get back to you as soon as possible.
        </p>

        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6; margin: 0;">
            <strong style="color: #8b5cf6;">📬 What's next?</strong> You'll hear back from us at <strong>support@candidai.tech</strong> — keep an eye on your inbox (and spam folder, just in case).
          </p>
        </div>

        <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #888888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your message</p>
          <p style="margin: 0 0 4px; color: #a78bfa; font-size: 13px; font-weight: 600;">${subject}</p>
          <p style="margin: 8px 0 0; color: #d1d5db; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
        </div>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
          <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
            This is an automated confirmation — please do not reply to this email.
          </p>
        </div>
      `, "We've received your support request and will be in touch soon"),
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
}
