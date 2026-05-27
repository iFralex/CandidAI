/**
 * server-track.ts
 * Write analytics events to Firestore directly from server-side code
 * (webhooks, server actions, API routes). Mirrors the schema used by the
 * client-side `track()` in `@/lib/analytics` so the /analytics dashboard
 * treats both uniformly.
 *
 * Fire-and-forget: never throws, never blocks user-visible work.
 */
import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface ServerEvent {
    event: string;
    params?: Record<string, unknown>;
    userId?: string | null;
    /** Optional override for `page_path` (defaults to null server-side). */
    pagePath?: string | null;
}

export async function recordServerEvent({ event, params, userId, pagePath }: ServerEvent): Promise<void> {
    try {
        await adminDb.collection("analytics_events").add({
            event,
            params: params ?? {},
            user_id: userId ?? null,
            session_id: null,
            page_path: pagePath ?? null,
            timestamp: FieldValue.serverTimestamp(),
            source: "server",
        });
    } catch (err) {
        console.error(`recordServerEvent(${event}) failed:`, err);
    }
}

/**
 * Record a successful Stripe payment with revenue/conversion params.
 * Also detects whether this is the user's first paid purchase (counts
 * existing `payments` docs for the user before this one was written).
 */
export async function recordPaymentSuccess(args: {
    userId: string;
    purchaseType: "plan" | "credits" | string | undefined;
    itemId: string | undefined;
    amountCents: number;
    currency: string;
    isOnboarding: boolean;
    source: "webhook" | "payment-confirm" | "create-payment-free";
}): Promise<void> {
    let isFirstPurchase = false;
    try {
        // The just-written payment doc is already counted — first purchase ⇔ exactly 1 doc.
        const payments = await adminDb.collection("users").doc(args.userId).collection("payments").limit(2).get();
        isFirstPurchase = payments.size <= 1;
    } catch { /* ignore — analytics must never break the webhook */ }

    await recordServerEvent({
        event: "payment_succeeded",
        userId: args.userId,
        params: {
            purchase_type: args.purchaseType ?? "unknown",
            item_id: args.itemId ?? "unknown",
            amount_cents: args.amountCents,
            amount: args.amountCents / 100,
            currency: args.currency,
            is_first_purchase: isFirstPurchase,
            is_onboarding: args.isOnboarding,
            source: args.source,
        },
    });
}
