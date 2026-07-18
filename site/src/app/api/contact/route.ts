import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { name, email, subject, message, userId, mode, referralApplication } = await req.json();
        const isReferral = mode === "referral";

        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
        }

        // Length caps — bound the payload of this public, unauthenticated endpoint.
        if (String(name).length > 100 || String(email).length > 120 ||
            String(subject).length > 200 || String(message).length > 5000) {
            return NextResponse.json({ error: "One or more fields are too long" }, { status: 400 });
        }

        const allowedRoles = new Set(["student", "graduate", "community_manager", "creator", "other"]);
        const allowedAudienceSizes = new Set(["Under 100", "100–500", "501–2,000", "2,001–10,000", "More than 10,000"]);
        if (isReferral) {
            const application = referralApplication ?? {};
            if (subject !== "Referral Program" || !String(application.location ?? "").trim() ||
                !allowedRoles.has(application.role) || !String(application.channels ?? "").trim() ||
                !allowedAudienceSizes.has(application.audienceSize) || application.acceptsRules !== true ||
                application.contactConsent !== true) {
                return NextResponse.json({ error: "Complete all required ambassador application fields" }, { status: 400 });
            }
            if (String(application.location).length > 160 || String(application.organization ?? "").length > 200 ||
                String(application.channels).length > 500 || String(application.profileUrl ?? "").length > 500) {
                return NextResponse.json({ error: "One or more application fields are too long" }, { status: 400 });
            }
            if (application.profileUrl) {
                try {
                    const profileUrl = new URL(application.profileUrl);
                    if (!['http:', 'https:'].includes(profileUrl.protocol)) throw new Error("invalid protocol");
                } catch {
                    return NextResponse.json({ error: "Enter a valid profile or community URL" }, { status: 400 });
                }
            }
        }

        // Escape every user-supplied field before interpolating into HTML — not
        // just the message. name/email/subject/userId were previously injected raw.
        const esc = (s: unknown) => String(s ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const safeName = esc(name);
        const safeEmail = esc(email);
        const safeSubject = esc(subject);
        const safeUserId = esc(userId);
        const safeMessage = esc(message);
        const safeApplication = isReferral ? {
            location: esc(referralApplication.location),
            organization: esc(referralApplication.organization || "Not provided"),
            role: esc(referralApplication.role),
            channels: esc(referralApplication.channels),
            profileUrl: esc(referralApplication.profileUrl || "Not provided"),
            audienceSize: esc(referralApplication.audienceSize),
        } : null;
        const applicationHtml = safeApplication ? `
          <p style="margin:20px 0 12px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(139,92,246,0.2);padding-top:20px;">Ambassador application</p>
          <p style="margin:0 0 8px;color:#e5e7eb;font-size:14px;"><strong>Location:</strong> ${safeApplication.location}</p>
          <p style="margin:0 0 8px;color:#e5e7eb;font-size:14px;"><strong>University / organization:</strong> ${safeApplication.organization}</p>
          <p style="margin:0 0 8px;color:#e5e7eb;font-size:14px;"><strong>Role:</strong> ${safeApplication.role}</p>
          <p style="margin:0 0 8px;color:#e5e7eb;font-size:14px;"><strong>Promotion channels:</strong> ${safeApplication.channels}</p>
          <p style="margin:0 0 8px;color:#e5e7eb;font-size:14px;"><strong>Profile / community:</strong> ${safeApplication.profileUrl}</p>
          <p style="margin:0;color:#e5e7eb;font-size:14px;"><strong>Approximate audience:</strong> ${safeApplication.audienceSize}</p>` : "";

        await Promise.all([
            // Internal notification to support team
            resend.emails.send({
                from: "CandidAI Contact <no-reply@candidai.tech>",
                to: "hello@candidai.tech",
                replyTo: email,
                subject: `[Contact] ${subject} - from ${name}`,
                html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Contact Message</title></head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0f0f0f;">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.15);">
        <tr><td style="background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);padding:40px 40px 30px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">New Contact Message</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">CandidAI Support</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 4px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">From</p>
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${safeName}</p>
          <p style="margin:4px 0 0;color:#8b5cf6;font-size:14px;">${safeEmail}</p>
          ${userId ? `<p style="margin:4px 0 0;color:#666666;font-size:12px;">User ID: ${safeUserId}</p>` : ""}
          <p style="margin:20px 0 4px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(139,92,246,0.2);padding-top:20px;">Subject</p>
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${safeSubject}</p>
          ${applicationHtml}
          <p style="margin:20px 0 12px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-top:1px solid rgba(139,92,246,0.2);padding-top:20px;">Message</p>
          <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px;padding:20px;">
            <p style="margin:0;color:#e5e7eb;font-size:15px;line-height:1.7;white-space:pre-wrap;">${safeMessage}</p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;background-color:#1a1a1a;border-top:1px solid rgba(139,92,246,0.2);text-align:center;">
          <p style="margin:0;color:#666666;font-size:12px;">Reply directly to this email to respond to ${safeName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
            }),

            // Confirmation email to the requester via send-email API (shared template)
            fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Internal-Key": process.env.SESSION_API_KEY ?? "",
                },
                body: JSON.stringify({
                    type: "contact-confirmation",
                    data: { email, name, subject, message: safeMessage },
                }),
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
}
