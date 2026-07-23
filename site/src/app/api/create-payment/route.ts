// app/api/create-payment/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { plansInfo, CREDIT_PACKAGES, isPlanPurchasable } from "@/config";
import { applyDiscount } from "@/lib/utils";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateDiscountCode, incrementDiscountUsage } from "@/lib/discount-codes";
import { recordPaymentSuccess } from "@/lib/server-track";
import { computePlanGrant, recordPlanPurchaseTransition, type PlanGrantOutcome } from "@/lib/plan-purchase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-11-17.clover" });

export async function POST(req: Request) {
    const { payment_method_id, purchaseType, itemId, discountCode, acceptedTerms, requestedImmediatePerformance, termsVersion } = await req.json();

    if (!purchaseType || !itemId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (acceptedTerms !== true || requestedImmediatePerformance !== true || termsVersion !== "2026-07-19") {
        return NextResponse.json({ error: "Terms and immediate-performance consent are required" }, { status: 400 });
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
            // Never let a user drop to a lower tier than they already own — it
            // would strip paid-for features. Enforced here, the single entry
            // point for every purchase (paid PaymentIntent and free < €1 alike).
            if (!isPlanPurchasable(user.plan, itemId)) {
                return NextResponse.json({ error: "You already own a plan at this level or higher." }, { status: 400 });
            }
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

        // Re-validate the discount server-side — never trust client-supplied
        // discountCode for the actual price applied. If the code is gone,
        // disabled, expired, or rate-limited between checkout-open and
        // payment, refuse to silently overcharge or undercharge.
        let appliedDiscountCode: string | null = null;
        if (discountCode) {
            const validation = await validateDiscountCode(discountCode);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: `Discount code is no longer valid (${validation.reason}). Please remove it and try again.` },
                    { status: 400 }
                );
            }
            amountInCents = applyDiscount(amountInCents, { type: validation.discount.type, value: validation.discount.value });
            appliedDiscountCode = validation.discount.code;
        }

        // Bypass Stripe for amounts under €1 (Stripe minimum is €0.50)
        if (amountInCents < 100) {
            const userRef = adminDb.collection("users").doc(user.uid);
            // Deterministic doc ID prevents double-claim on double-click /
            // concurrent requests: a previous random doc ID let two requests
            // both create distinct docs and double-grant credits.
            const freeKey = `free-${purchaseType}-${itemId}-${appliedDiscountCode ?? "none"}`;
            const paymentRef = userRef.collection("payments").doc(freeKey);

            let alreadyProcessed = false;
            let planOutcome: PlanGrantOutcome | null = null;

            let userSnapData: Record<string, any> | undefined;
            let resultsData: Record<string, any> | undefined;
            if (purchaseType === "plan") {
                const [userSnap, resultsSnap] = await Promise.all([
                    userRef.get(),
                    adminDb.collection("users").doc(user.uid).collection("data").doc("results").get(),
                ]);
                userSnapData = userSnap.data();
                resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
            }

            await adminDb.runTransaction(async (tx) => {
                const existing = await tx.get(paymentRef);
                if (existing.exists) { alreadyProcessed = true; return; }

                tx.set(paymentRef, {
                    type: "free",
                    purchaseType,
                    itemId,
                    amount: 0,
                    currency: "eur",
                    status: "succeeded",
                    discountCode: appliedDiscountCode,
                    termsAcceptance: {
                        version: termsVersion,
                        accepted: true,
                        immediatePerformanceRequested: true,
                        acceptedAt: new Date(),
                    },
                    createdAt: new Date(),
                });

                if (purchaseType === "credits") {
                    const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId)!;
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
                return NextResponse.json({ success: true, free: true, alreadyProcessed: true });
            }

            // Side effects run AT MOST ONCE per (user, item, discount) combo
            // thanks to the deterministic paymentRef + transaction.
            if (appliedDiscountCode) {
                await incrementDiscountUsage(appliedDiscountCode);
            }

            await recordPaymentSuccess({
                userId: user.uid,
                purchaseType,
                itemId,
                amountCents: 0,
                currency: "eur",
                isOnboarding: planOutcome === "first_paid",
                source: "create-payment-free",
            });
            if (purchaseType === "plan" && planOutcome) {
                await recordPlanPurchaseTransition({ outcome: planOutcome, userId: user.uid, itemId, userData: userSnapData, paymentId: freeKey });
            }

            // No startServer at payment time: the buyer launches explicitly from
            // the post-purchase flow (idempotent generation).

            await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.SESSION_API_KEY ?? "" },
                body: JSON.stringify({
                    userId: user.uid,
                    type: "purchase-confirmation",
                    dedupeKey: `purchase-confirmation:${freeKey}`,
                    category: "transactional",
                    data: { amount: "€0.00", item: purchaseType === "plan" ? `${plansInfo.find(plan => plan.id === itemId)?.name ?? itemId} Plan` : `${CREDIT_PACKAGES.find(pkg => pkg.id === itemId)?.credits ?? ""} Credits`, newBalance: 0, receiptUrl: null },
                }),
            }).catch(() => undefined);

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
                // Persisted on the PaymentIntent so webhook/payment-confirm can
                // re-apply the same code without re-trusting the client.
                discountCode: appliedDiscountCode ?? "",
                termsVersion,
                termsAccepted: "true",
                immediatePerformanceRequested: "true",
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
