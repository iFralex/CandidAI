/**
 * analytics-auth.ts
 * HTTP Basic Auth gate for /analytics.
 * Password = SESSION_API_KEY from env. Username is ignored.
 */

export const ANALYTICS_REALM = "CandidAI Analytics";

/** Verify an `Authorization: Basic ...` header against SESSION_API_KEY. */
export function checkBasicAuth(authHeader: string | null | undefined): boolean {
    if (!authHeader || !authHeader.startsWith("Basic ")) return false;

    const key = process.env.SESSION_API_KEY;
    if (!key) return false;

    let decoded: string;
    try {
        decoded = atob(authHeader.slice(6).trim());
    } catch {
        return false;
    }

    // Format is "username:password" — we only care about password
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const password = decoded.slice(idx + 1);

    // Constant-time compare (length-agnostic short-circuit only)
    if (password.length !== key.length) return false;
    let diff = 0;
    for (let i = 0; i < password.length; i++) {
        diff |= password.charCodeAt(i) ^ key.charCodeAt(i);
    }
    return diff === 0;
}
