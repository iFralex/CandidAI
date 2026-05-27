/**
 * Discount codes — server-only Firestore-backed registry.
 *
 * Schema (collection `discount_codes`, doc id = code lowercased):
 *   code           original-case string for display (WELCOME15)
 *   type           "percentage" | "fixed"
 *   value          percent (1..100) for percentage, cents for fixed
 *   enabled        true → usable, false → soft-disabled
 *   expires_at     Timestamp | null
 *   max_uses       number | null   (null = unlimited)
 *   used_count     number          (incremented on successful payment)
 *   created_at     Timestamp
 *   notes          string | null
 *
 * Read path: `validateDiscountCode(code)` — cached 60s in-memory per server
 *   instance so a busy checkout doesn't hammer Firestore. Cache invalidates
 *   automatically after TTL; admin changes propagate within ≤60s.
 *
 * Usage increment: `incrementDiscountUsage(code)` — Firestore transaction
 *   so two concurrent checkouts with the same code on a max_uses=1 coupon
 *   can never both succeed.
 *
 * Nothing in this file is callable from the browser (server-only marker +
 * uses firebase-admin). Client calls go through /api/discount/validate.
 */
import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const COLLECTION = "discount_codes";
const CACHE_TTL_MS = 60_000;

export interface DiscountCode {
    code: string;
    type: "percentage" | "fixed";
    value: number;
    enabled: boolean;
    expires_at: Date | null;
    max_uses: number | null;
    used_count: number;
    notes?: string | null;
}

export type ValidationResult =
    | { valid: true; discount: DiscountCode }
    | { valid: false; reason: "unknown" | "disabled" | "expired" | "max_uses_reached" };

interface CacheEntry { fetchedAt: number; doc: DiscountCode | null }
const cache = new Map<string, CacheEntry>();

function normalize(raw: string): string {
    return raw.trim().toLowerCase();
}

/** Read a code from Firestore (cached). Returns null if doc missing. */
export async function getDiscountCode(raw: string): Promise<DiscountCode | null> {
    const key = normalize(raw);
    if (!key) return null;

    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.doc;
    }

    const snap = await adminDb.collection(COLLECTION).doc(key).get();
    if (!snap.exists) {
        cache.set(key, { fetchedAt: Date.now(), doc: null });
        return null;
    }
    const d = snap.data() ?? {};
    const doc: DiscountCode = {
        code: String(d.code ?? key.toUpperCase()),
        type: d.type === "fixed" ? "fixed" : "percentage",
        value: Number(d.value ?? 0),
        enabled: d.enabled !== false,
        expires_at: d.expires_at instanceof Timestamp ? d.expires_at.toDate() : null,
        max_uses: d.max_uses != null ? Number(d.max_uses) : null,
        used_count: Number(d.used_count ?? 0),
        notes: d.notes ?? null,
    };
    cache.set(key, { fetchedAt: Date.now(), doc });
    return doc;
}

/** Validate eligibility (enabled + not expired + under max_uses). */
export async function validateDiscountCode(raw: string): Promise<ValidationResult> {
    const doc = await getDiscountCode(raw);
    if (!doc) return { valid: false, reason: "unknown" };
    if (!doc.enabled) return { valid: false, reason: "disabled" };
    if (doc.expires_at && doc.expires_at.getTime() < Date.now()) {
        return { valid: false, reason: "expired" };
    }
    if (doc.max_uses != null && doc.used_count >= doc.max_uses) {
        return { valid: false, reason: "max_uses_reached" };
    }
    return { valid: true, discount: doc };
}

/**
 * Increment used_count atomically. Returns true if increment succeeded
 * within max_uses (or if no cap), false if cap was reached between
 * validation and payment confirmation (rare race).
 *
 * MUST be called only AFTER a successful payment write, inside the same
 * idempotent guard, so it never runs twice for the same payment.
 */
export async function incrementDiscountUsage(raw: string): Promise<boolean> {
    const key = normalize(raw);
    const ref = adminDb.collection(COLLECTION).doc(key);
    try {
        const ok = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return false;
            const data = snap.data() ?? {};
            const maxUses = data.max_uses != null ? Number(data.max_uses) : null;
            const usedCount = Number(data.used_count ?? 0);
            if (maxUses != null && usedCount >= maxUses) return false;
            tx.update(ref, {
                used_count: FieldValue.increment(1),
                last_used_at: FieldValue.serverTimestamp(),
            });
            return true;
        });
        // Cache will be stale for up to 60s — acceptable for this use case.
        // For tighter consistency we could invalidate(key) here.
        cache.delete(key);
        return ok;
    } catch (err) {
        console.error(`incrementDiscountUsage(${raw}) failed:`, err);
        return false;
    }
}
