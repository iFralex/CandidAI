import Stripe from "stripe";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { plansData, CREDIT_PACKAGES } from "@/config";
import { startServer } from "@/actions/onboarding-actions";
import { FieldValue } from "firebase-admin/firestore";
import { recordPaymentSuccess } from "@/lib/server-track";
import { incrementDiscountUsage } from "@/lib/discount-codes";

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
        let isOnboardingPurchase = false;

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
                const planData = plansData[itemId as keyof typeof plansData];
                const includedCredits = planData?.credits || 0;
                const newPlanMaxCompanies = planData?.maxCompanies || 0;

                const currentMax: number = userSnapData?.maxCompanies ?? 0;
                const usedCount = Object.entries(resultsData ?? {}).filter(
                    ([k, v]: any) => k !== "companies_to_confirm" && typeof v === "object" && v?.company
                ).length;
                const remaining = Math.max(0, currentMax - usedCount);
                const maxCompanies = newPlanMaxCompanies + remaining;

                const currentOnboardingStep: number = userSnapData?.onboardingStep ?? 50;
                const isOnboarding = currentOnboardingStep < 10;
                isOnboardingPurchase = isOnboarding;
                tx.update(userRef, {
                    plan: itemId,
                    maxCompanies: isOnboarding ? newPlanMaxCompanies : maxCompanies,
                    credits: FieldValue.increment(includedCredits),
                    onboardingStep: isOnboarding ? 6 : 50,
                    ...(isOnboarding ? { onboardingStage: "post_purchase" } : {}),
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
            isOnboarding: isOnboardingPurchase,
            source: "payment-confirm",
        });

        if (purchaseType === "plan" && !isOnboardingPurchase) {
            try {
                await startServer(userId as any);
            } catch (err) {
                console.error("Failed to start server:", err);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
