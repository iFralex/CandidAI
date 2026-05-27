/**
 * One-click unsubscribe — token + URL builder.
 *
 * Token = first 16 hex chars of HMAC-SHA256(uid, SESSION_API_KEY). Stable
 * for a given uid (so old emails keep working) but unguessable for anyone
 * who doesn't know the secret. The `users/{uid}.unsubscribed` flag is the
 * source of truth; cron emails skip users with this flag set.
 *
 * Compatible with RFC 8058 List-Unsubscribe-Post=One-Click for inbox-
 * provider native unsubscribe buttons (Gmail "Unsubscribe" link, etc.).
 */
import "server-only";
import { createHmac } from "crypto";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";

function getSecret(): string {
    const key = process.env.SESSION_API_KEY;
    if (!key) throw new Error("SESSION_API_KEY is required for unsubscribe tokens");
    return key;
}

export function createUnsubscribeToken(uid: string): string {
    return createHmac("sha256", getSecret()).update(uid).digest("hex").slice(0, 16);
}

export function verifyUnsubscribeToken(uid: string, token: string): boolean {
    if (!uid || !token || token.length !== 16) return false;
    const expected = createUnsubscribeToken(uid);
    // Constant-time-ish: lengths match by construction, then compare chars
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
}

/** Full URL to embed in marketing email footers + List-Unsubscribe header. */
export function buildUnsubscribeUrl(uid: string): string {
    const token = createUnsubscribeToken(uid);
    return `${DOMAIN}/api/unsubscribe?uid=${encodeURIComponent(uid)}&token=${token}`;
}
