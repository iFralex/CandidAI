import Stripe from "stripe";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { plansData, CREDIT_PACKAGES } from "@/config";
import { startServer } from "@/actions/onboarding-actions";
import { FieldValue } from "firebase-admin/firestore";

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

        const { userId, purchaseType, itemId } = pi.metadata;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId in metadata" }, { status: 400 });
        }

        const userRef = adminDb.collection("users").doc(userId);
        const paymentRef = userRef.collection("payments").doc(pi.id);

        // Idempotency: skip if already processed by webhook
        const existingPayment = await paymentRef.get();
        if (existingPayment.exists) {
            return NextResponse.json({ success: true });
        }

        const batch = adminDb.batch();

        batch.set(paymentRef, {
            type: "one_time",
            purchaseType,
            itemId,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            payment_method: pi.payment_method,
            createdAt: new Date(),
        });

        if (purchaseType === "credits") {
            const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
            if (!pkg) throw new Error("Credit package not found");
            batch.update(userRef, { credits: FieldValue.increment(pkg.credits) });
        } else if (purchaseType === "plan") {
            const planData = plansData[itemId as keyof typeof plansData];
            const includedCredits = planData?.credits || 0;
            const newPlanMaxCompanies = planData?.maxCompanies || 0;

            // Carry over unused companies from the previous allocation.
            const [userSnap, resultsSnap] = await Promise.all([
                userRef.get(),
                adminDb.collection("users").doc(userId as string).collection("data").doc("results").get(),
            ]);
            const currentMax: number = userSnap.data()?.maxCompanies ?? 0;
            const resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
            const usedCount = Object.entries(resultsData).filter(
                ([k, v]: any) => k !== "companies_to_confirm" && typeof v === "object" && v?.company
            ).length;
            const remaining = Math.max(0, currentMax - usedCount);
            const maxCompanies = newPlanMaxCompanies + remaining;

            const currentOnboardingStep: number = userSnap.data()?.onboardingStep ?? 50;
            batch.update(userRef, {
                plan: itemId,
                maxCompanies,
                credits: FieldValue.increment(includedCredits),
                onboardingStep: currentOnboardingStep < 10 ? 7 : 50,
            });
        }

        await batch.commit();

        if (purchaseType === "plan") {
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
