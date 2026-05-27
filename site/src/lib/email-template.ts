/**
 * Shared HTML email shell for outbound user-facing emails.
 *
 * Matches the visual identity of /api/send-email transactional emails:
 *   dark background, purple gradient header, rounded card, footer with
 *   "Visit Dashboard / Help / Contact" links + unsubscribe.
 *
 * Used by: cron/onboarding-sequence, cron/drip-stalled, and any future
 * outbound flow. The transactional /api/send-email route still has its
 * own inline copy for now — migrate it incrementally.
 */
import "server-only";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";

export interface EmailShellOptions {
    /** Hidden inbox preview text (shows next to the subject in Gmail/Apple Mail). */
    preheader?: string;
    /** Optional small uppercase badge above the title (e.g. "ONBOARDING"). */
    badge?: string;
    /** Per-user unsubscribe URL (with HMAC token). Marketing emails should pass
     *  this so the footer "Unsubscribe" link actually works. Omit for
     *  transactional emails — those aren't opt-in and aren't unsubscribable. */
    unsubscribeUrl?: string;
}

export function wrapEmail(content: string, options: EmailShellOptions = {}): string {
    const { preheader = "", badge, unsubscribeUrl } = options;
    // Only render the Unsubscribe row when a per-user URL is provided
    // (marketing/drip emails). Transactional emails (receipts, password
    // resets) aren't opt-in, so showing an Unsubscribe link there would
    // be misleading — previously it pointed to /unsubscribed without a
    // token, which can't actually unsubscribe anyone.
    const unsubscribeRow = unsubscribeUrl ? `
                <tr>
                  <td style="text-align: center; padding-top: 20px;">
                    <a href="${unsubscribeUrl}" style="color: #666666; text-decoration: underline; font-size: 11px;">Unsubscribe</a>
                  </td>
                </tr>` : "";
    const badgeHtml = badge ? `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px 24px; background: rgba(139, 92, 246, 0.1); border-radius: 24px;">
            <span style="color: #8b5cf6; font-size: 14px; font-weight: 600;">${escapeHtml(badge)}</span>
          </div>
        </div>` : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>CandidAI</title>
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]><style type="text/css">body, table, td {font-family: Arial, sans-serif !important;}</style><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f0f0f;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15);">
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">CandidAI</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">Your AI-Powered Career Accelerator</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              ${badgeHtml}
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #1a1a1a; border-top: 1px solid rgba(139, 92, 246, 0.2);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <a href="${DOMAIN}/dashboard" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Visit Dashboard</a>
                    <span style="color: #666666; margin: 0 12px;">•</span>
                    <a href="${DOMAIN}/dashboard/help" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Help Center</a>
                    <span style="color: #666666; margin: 0 12px;">•</span>
                    <a href="${DOMAIN}/contact" style="color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 14px;">Contact Us</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; color: #888888; font-size: 12px; line-height: 18px;">
                    <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} CandidAI. All rights reserved.</p>
                    <p style="margin: 0; color: #666666;">Transforming job search with AI-powered personalization</p>
                  </td>
                </tr>
                ${unsubscribeRow}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(text: string, link: string, isPrimary = true): string {
    const bg = isPrimary
        ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
        : "transparent";
    const border = isPrimary ? "none" : "2px solid #8b5cf6";
    return `<a href="${link}" style="display: inline-block; padding: 16px 32px; background: ${bg}; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; border: ${border}; margin: 10px 0;">${escapeHtml(text)}</a>`;
}

/** Highlighted "did you know" / tip box, purple left-border. */
export function tipBox(html: string): string {
    return `<div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 8px;">
        <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6; margin: 0;">${html}</p>
    </div>`;
}

export function heading(html: string): string {
    return `<h2 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 16px; line-height: 1.3;">${html}</h2>`;
}

export function paragraph(html: string): string {
    return `<p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">${html}</p>`;
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
