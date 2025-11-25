// app/api/create-subscription/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { billingData, plansInfo } from "@/config";
import { getReferralDiscountServer } from "@/lib/utils-server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { startServer } from "@/actions/onboarding-actions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req) {
    const { payment_method_id } = await req.json();

    try {
        const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
            credentials: "include",
            cache: "no-cache",
            headers: {
                cookie: await cookies()
            }
        });

        if (!res.ok) throw new Error(res.status);

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const user = data.user;
        if (!user) throw new Error("Utente non autenticato");

        // 1️⃣ Crea o recupera il Customer
        const searchResult = await stripe.customers.search({
            query: `metadata['userId']:'${user.uid}'`
        });

        let customer = searchResult.data[0];

        if (!customer) {
            customer = await stripe.customers.create({
                email: user.email,
                business_name: user.name || undefined,
                payment_method: payment_method_id,
                invoice_settings: {
                    default_payment_method: payment_method_id
                },
                metadata: { userId: user.uid }
            });
        }

        const computePriceInCents = (planId, billingType, refDiscount) => {
            const plan = plansInfo.find((p) => p.id === planId);
            if (!plan) return 0;

            const baseCents = Math.round(plan.price * 100);
            const option = billingData[billingType] || billingData.monthly;
            const months = option.activableTimes || 1;
            const discount = option.discount || 0;

            return Math.round(
                baseCents * months * (1 - discount / 100) * (1 - refDiscount / 100)
            );
        };

        const refDiscount = await getReferralDiscountServer();

        // -----------------------------
        // LIFETIME / ONE-TIME PAYMENT
        // -----------------------------
        if (user.billingType === "lifetime") {
            const plan = plansInfo.find(p => p.id === user.plan);
            if (!plan) throw new Error("Piano non valido");

            const lifetimeBaseCents = Math.round(plan.pricesLifetime * 100);
            const lifetimeFinalCents = Math.round(lifetimeBaseCents * (1 - refDiscount / 100));

            const paymentIntent = await stripe.paymentIntents.create({
                amount: lifetimeFinalCents,
                currency: "eur",
                customer: customer.id,
                payment_method: payment_method_id,
                confirm: false,
            });

            // ✅ Salva info pagamento in Firestore
            await adminDb
                .collection("users")
                .doc(user.uid)
                .collection("payments")
                .doc(paymentIntent.id)
                .set({
                    type: "one_time",
                    amount: lifetimeFinalCents,
                    currency: "eur",
                    status: paymentIntent.status,
                    payment_method: payment_method_id,
                    createdAt: new Date(),
                    planId: user.plan,
                    billingType: user.billingType,
                });

            return NextResponse.json({
                client_secret: paymentIntent.client_secret,
                type: "one_time",
                amount: lifetimeFinalCents
            });
        }

        // -----------------------------
        // RECURRING / SUBSCRIPTION
        // -----------------------------
        const product = await stripe.products.create({ name: "Abbonamento biennale" });

        const price = await stripe.prices.create({
            unit_amount: computePriceInCents(user.plan, user.billingType, refDiscount),
            currency: "eur",
            recurring: {
                interval: "month",
                interval_count: billingData[user.billingType]?.durationM
            },
            product: product.id,
        });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            expand: ["latest_invoice.payment_intent"],
            payment_behavior: "default_incomplete",
        });

        const paymentIntent = subscription.latest_invoice.payment_intent;

        // ✅ Salva info pagamento solo se completato, in batch
        if (paymentIntent.status === "succeeded") {
            const batch = adminDb.batch();

            const paymentRef = adminDb
                .collection("users")
                .doc(user.uid)
                .collection("payments")
                .doc(subscription.id);

            const userRef = adminDb
                .collection("users")
                .doc(user.uid);

            let endDate: Date;

            if (user.billingType === "lifetime") {
                endDate = new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000); // 20 anni
            } else {
                const months = billingData[user.billingType]?.durationM;
                if (!months) throw new Error("Durata abbonamento non definita");

                endDate = new Date();
                endDate.setMonth(endDate.getMonth() + months);
            }

            // Aggiornamenti batch
            batch.set(paymentRef, {
                type: "recurring",
                subscriptionId: subscription.id,
                priceId: price.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                payment_method: payment_method_id,
                createdAt: new Date(),
                planId: user.plan,
                billingType: user.billingType,
            });

            batch.update(userRef, {
                expirate: Timestamp.fromDate(endDate),
                onboardingStep: 50
            });

            // Esegui batch
            await batch.commit();

            await startServer()
        }

        return NextResponse.json({
            client_secret: paymentIntent.client_secret,
            subscriptionId: subscription.id,
            type: "recurring"
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
