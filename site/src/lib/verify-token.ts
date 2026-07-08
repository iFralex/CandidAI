/**
 * Email-verification link token.
 *
 * The /verify/[id] page marks users/{uid} emailVerified=true. Because UIDs are
 * not secret (they appear in many API responses), the page MUST require an
 * unguessable token — otherwise anyone could verify anyone's email by visiting
 * /verify/<uid>, defeating email verification as a security control.
 *
 * Token = first 16 hex chars of HMAC-SHA256(uid, SESSION_API_KEY). Stable per
 * uid (old welcome emails keep working) but unforgeable without the secret.
 * Same construction as lib/unsubscribe.ts.
 */
import "server-only";
import { createHmac } from "crypto";

function getSecret(): string {
    const key = process.env.SESSION_API_KEY;
    if (!key) throw new Error("SESSION_API_KEY is required for verify tokens");
    return key;
}

export function createVerifyToken(uid: string): string {
    return createHmac("sha256", getSecret()).update(`verify:${uid}`).digest("hex").slice(0, 16);
}

export function verifyVerifyToken(uid: string, token: string): boolean {
    if (!uid || !token || token.length !== 16) return false;
    const expected = createVerifyToken(uid);
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
}

/** Full URL to embed in the welcome email. */
export function buildVerifyUrl(uid: string): string {
    const domain = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech";
    return `${domain}/verify/${encodeURIComponent(uid)}?token=${createVerifyToken(uid)}`;
}
