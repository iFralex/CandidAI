import Stripe from "stripe";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { plansInfo, CREDIT_PACKAGES } from "@/config";
import { FieldValue } from "firebase-admin/firestore";
import { recordPaymentSuccess } from "@/lib/server-track";
import { incrementDiscountUsage } from "@/lib/discount-codes";
import { computePlanGrant, recordPlanPurchaseTransition, type PlanGrantOutcome } from "@/lib/plan-purchase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-11-17.clover" });

export async function POST(req: Request) {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
        return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
    }

    try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (pi.status !== "succeeded") {
            return NextResponse.json({ error: "Payment not succeeded" }, { status: 400 });
        }

        const { userId, purchaseType, itemId, discountCode: rawDiscountCode } = pi.metadata;
        const discountCode = rawDiscountCode || null;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId in metadata" }, { status: 400 });
        }

        const userRef = adminDb.collection("users").doc(userId);
        const paymentRef = userRef.collection("payments").doc(pi.id);

        // Race-safe idempotency: see stripe-webhook for the full rationale.
        // /api/stripe-webhook and this endpoint can both fire for the same
        // payment within milliseconds; a non-transactional exists-then-set
        // check allowed both to pass and double-credited the user.
        let alreadyProcessed = false;
        let planOutcome: PlanGrantOutcome | null = null;

        // Pre-fetch out-of-transaction reads that don't need atomicity.
        let userSnapData: Record<string, any> | undefined;
        let resultsData: Record<string, any> | undefined;
        if (purchaseType === "plan") {
            const [userSnap, resultsSnap] = await Promise.all([
                userRef.get(),
                adminDb.collection("users").doc(userId).collection("data").doc("results").get(),
            ]);
            userSnapData = userSnap.data();
            resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
        }

        await adminDb.runTransaction(async (tx) => {
            const existing = await tx.get(paymentRef);
            if (existing.exists) { alreadyProcessed = true; return; }

            tx.set(paymentRef, {
                type: "one_time",
                purchaseType,
                itemId,
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status,
                payment_method: pi.payment_method,
                discountCode: discountCode ?? null,
                createdAt: new Date(),
            });

            if (purchaseType === "credits") {
                const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
                if (!pkg) throw new Error("Credit package not found");
                tx.update(userRef, { credits: FieldValue.increment(pkg.credits) });
            } else if (purchaseType === "plan") {
                const grant = computePlanGrant({ itemId, userData: userSnapData, resultsData });
                planOutcome = grant.outcome;
                tx.update(userRef, {
                    ...grant.fields,
                    credits: FieldValue.increment(grant.includedCredits),
                });
            }
        });

        if (alreadyProcessed) {
            return NextResponse.json({ success: true });
        }

        // Side effects below run AT MOST ONCE per payment because the
        // transaction above is atomic.
        if (discountCode) {
            await incrementDiscountUsage(discountCode);
        }

        await recordPaymentSuccess({
            userId,
            purchaseType,
            itemId,
            amountCents: pi.amount,
            currency: pi.currency,
            isOnboarding: planOutcome === "first_paid",
            source: "payment-confirm",
        });
        if (purchaseType === "plan" && planOutcome) {
            await recordPlanPurchaseTransition({ outcome: planOutcome, userId, itemId, userData: userSnapData, paymentId: pi.id });
        }

        // No startServer at payment time: the buyer launches explicitly from the
        // post-purchase flow. Server generation is idempotent, so nothing is
        // generated (or charged) until they add companies and launch.

        try {
            let receiptUrl: string | null = null;
            if (pi.latest_charge) {
                const charge = await stripe.charges.retrieve(pi.latest_charge as string);
                receiptUrl = charge.receipt_url ?? null;
            }
            const refreshedUser = await userRef.get();
            const itemName = purchaseType === "credits"
                ? `${CREDIT_PACKAGES.find(pkg => pkg.id === itemId)?.credits ?? ""} Credits`
                : `${plansInfo.find(plan => plan.id === itemId)?.name ?? itemId} Plan`;
            await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.SESSION_API_KEY ?? "" },
                body: JSON.stringify({
                    userId,
                    type: "purchase-confirmation",
                    dedupeKey: `purchase-confirmation:${pi.id}`,
                    category: "transactional",
                    data: { amount: `€${(pi.amount / 100).toFixed(2)}`, item: itemName, newBalance: refreshedUser.data()?.credits ?? 0, receiptUrl },
                }),
            });
        } catch (emailError) {
            console.error("Failed to send purchase confirmation:", emailError);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
