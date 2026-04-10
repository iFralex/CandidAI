import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

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
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Contact Message</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f0f;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.15);">
          <tr>
            <td style="background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">New Contact Message</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">CandidAI Support</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:20px;">
                    <p style="margin:0 0 4px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">From</p>
                    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${name}</p>
                    <p style="margin:4px 0 0;color:#8b5cf6;font-size:14px;">${email}</p>
                    ${userId ? `<p style="margin:4px 0 0;color:#666666;font-size:12px;">User ID: ${userId}</p>` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:20px;border-top:1px solid rgba(139,92,246,0.2);padding-top:20px;">
                    <p style="margin:0 0 4px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Subject</p>
                    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${subject}</p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid rgba(139,92,246,0.2);padding-top:20px;">
                    <p style="margin:0 0 12px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:20px;">
                      <p style="margin:0;color:#e5e7eb;font-size:15px;line-height:1.7;white-space:pre-wrap;">${safeMessage}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:#1a1a1a;border-top:1px solid rgba(139,92,246,0.2);text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">Reply directly to this email to respond to ${name}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
            }),

            // Confirmation email to the requester
            resend.emails.send({
                from: "CandidAI Support <noreply@candidai.tech>",
                to: email,
                subject: `We received your message — CandidAI Support`,
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>We received your message</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f0f;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.15);">
          <tr>
            <td style="background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">We got your message!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">CandidAI Support</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#e5e7eb;font-size:16px;line-height:1.6;">Hi ${name},</p>
              <p style="margin:0 0 16px;color:#e5e7eb;font-size:15px;line-height:1.7;">
                Thank you for reaching out. We've received your message and our team will get back to you as soon as possible.
              </p>
              <p style="margin:0 0 24px;color:#e5e7eb;font-size:15px;line-height:1.7;">
                You'll hear from us at <span style="color:#8b5cf6;font-weight:600;">support@candidai.tech</span> — make sure to check your inbox (and spam folder, just in case).
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your message</p>
                    <p style="margin:0 0 4px;color:#a78bfa;font-size:13px;font-weight:600;">${subject}</p>
                    <p style="margin:8px 0 0;color:#d1d5db;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;background-color:#1a1a1a;border-top:1px solid rgba(139,92,246,0.2);text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">This is an automated confirmation — please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
}
