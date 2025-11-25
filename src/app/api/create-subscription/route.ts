// app/api/create-subscription/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { billingData, plansInfo } from "@/config";
import { getReferralDiscount } from "@/lib/utils";

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

        if (!res.ok) {
            throw new Error(res.status);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const user = data.user;
        if (!user) throw new Error("Utente non autenticato");

        // 1. Crea o recupera il Customer
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

        // Funzione per calcolare i prezzi ricorrenti
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

        const refDiscount = await getReferralDiscount();

        // ------------------------------------------------------------------
        // ⭐ LOGICA PER PAGAMENTO UNA TANTUM (LIFETIME)
        // ------------------------------------------------------------------
        if (user.billingType === "lifetime") {
            const plan = plansInfo.find(p => p.id === user.plan);
            if (!plan) throw new Error("Piano non valido");

            const lifetimeBaseCents = Math.round(plan.pricesLifetime * 100);

            const lifetimeFinalCents = Math.round(
                lifetimeBaseCents * (1 - refDiscount / 100)
            );

            // Crea payment intent singolo
            const paymentIntent = await stripe.paymentIntents.create({
                amount: lifetimeFinalCents,
                currency: "eur",
                customer: customer.id,
                payment_method: payment_method_id,
                confirm: false,  // Il client lo conferma
            });

            return NextResponse.json({
                client_secret: paymentIntent.client_secret,
                type: "one_time",
                amount: lifetimeFinalCents
            });
        }

        // ------------------------------------------------------------------
        // ⭐ LOGICA STANDARD ABBONAMENTO
        // ------------------------------------------------------------------

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