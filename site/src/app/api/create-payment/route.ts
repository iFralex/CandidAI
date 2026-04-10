// app/api/create-payment/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { plansInfo, CREDIT_PACKAGES, plansData } from "@/config";
import { applyDiscount } from "@/lib/utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { startServer } from "@/actions/onboarding-actions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req: Request) {
    const { payment_method_id, purchaseType, itemId, discountCode } = await req.json();

    if (!purchaseType || !itemId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
            credentials: "include",
            cache: "no-cache",
            headers: {
                cookie: (await cookies()).toString()
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Authentication failed" }, { status: res.status });
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const user = data.user;
        if (!user) throw new Error("Utente non autenticato");

        let amountInCents: number;

        if (purchaseType === "plan") {
            const plan = plansInfo.find((p) => p.id === itemId);
            if (!plan) return NextResponse.json({ error: "Piano non valido" }, { status: 400 });
            amountInCents = Math.round(plan.price * 100);
            if (amountInCents === 0) {
                return NextResponse.json({ error: "Free plans do not require payment" }, { status: 400 });
            }
        } else if (purchaseType === "credits") {
            const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
            if (!pkg) return NextResponse.json({ error: "Pacchetto crediti non valido" }, { status: 400 });
            amountInCents = pkg.price;
        } else {
            return NextResponse.json({ error: "purchaseType non valido" }, { status: 400 });
        }

        if (discountCode) {
            amountInCents = applyDiscount(amountInCents, discountCode);
        }

        // Bypass Stripe for amounts under €1 (Stripe minimum is €0.50)
        if (amountInCents < 100) {
            const userRef = adminDb.collection("users").doc(user.uid);
            const paymentRef = userRef.collection("payments").doc();

            const batch = adminDb.batch();
            batch.set(paymentRef, {
                type: "free",
                purchaseType,
                itemId,
                amount: 0,
                currency: "eur",
                status: "succeeded",
                discountCode: discountCode ?? null,
                createdAt: new Date(),
            });

            if (purchaseType === "credits") {
                const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId)!;
                batch.update(userRef, { credits: FieldValue.increment(pkg.credits) });
            } else if (purchaseType === "plan") {
                const planData = plansData[itemId as keyof typeof plansData];
                const newPlanMaxCompanies = planData?.maxCompanies ?? 0;

                // Carry over unused companies from the previous allocation.
                const [userSnap, resultsSnap] = await Promise.all([
                    userRef.get(),
                    adminDb.collection("users").doc(user.uid).collection("data").doc("results").get(),
                ]);
                const currentMax: number = userSnap.data()?.maxCompanies ?? 0;
                const resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
                const usedCount = Object.entries(resultsData).filter(
                    ([k, v]: any) => k !== "companies_to_confirm" && typeof v === "object" && v?.company
                ).length;
                const remaining = Math.max(0, currentMax - usedCount);
                const maxCompanies = newPlanMaxCompanies + remaining;

                const currentOnboardingStep: number = userSnap.data()?.onboardingStep ?? 50;
                const isOnboarding = currentOnboardingStep < 10;
                batch.update(userRef, {
                    plan: itemId,
                    maxCompanies: isOnboarding ? newPlanMaxCompanies : maxCompanies,
                    credits: FieldValue.increment(planData?.credits ?? 0),
                    onboardingStep: isOnboarding ? 7 : 50,
                });
            }

            await batch.commit();

            if (purchaseType === "plan") {
                try { await startServer(user.uid); } catch { /* non bloccante */ }
            }

            return NextResponse.json({ success: true, free: true });
        }

        if (!payment_method_id) {
            return NextResponse.json({ error: "Missing payment_method_id" }, { status: 400 });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "eur",
            payment_method: payment_method_id,
            confirm: false,
            metadata: {
                userId: user.uid,
                purchaseType,
                itemId,
            },
        });

        return NextResponse.json({
            client_secret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            type: "one_time",
            amount: amountInCents,
        });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
