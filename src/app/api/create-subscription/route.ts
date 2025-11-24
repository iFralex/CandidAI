// app/api/create-subscription/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { billingData, plansInfo } from "@/config";
import { getReferralDiscount } from "@/lib/utils-server";

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

        if (!data.success)
            throw new Error(data.error)

        const user = data.user
        if (!user)
            throw new Error("Utente non autenticato");

        // 1. Crea o recupera il Customer
        // Cerca customer tramite metadata.userId
        const searchResult = await stripe.customers.search({
            query: `metadata['userId']:'${user.uid}'`
        });

        let customer = searchResult.data[0];

        if (!customer) {
            customer = await stripe.customers.create({
                email: user.email, // non univoca, ma utile
                business_name: user.name || undefined,
                payment_method: payment_method_id,
                invoice_settings: {
                    default_payment_method: payment_method_id
                },
                metadata: { userId: user.uid }  // <– questo è il campo principale
            });
        }

        const computePriceInCents = (planId, billingType, refDiscount) => {
            const plan = plansInfo.find((p) => p.id === planId)
            if (!plan) return 0;
        
            // Basic pricing rules: monthly price * months in billing period * (1 - discount%)
            const baseCents = Math.round(plan.price * 100);
            const option = billingData[billingType] || billingData.monthly;
            const months = option.activableTimes || 1;
            const discount = option.discount || 0
        
            const total = Math.round(baseCents * months * (1 - discount / 100) * (1 - refDiscount / 100));
            return total;
        };

        // 2. Crea Price dinamico (25€ ogni 2 anni)
        const product = await stripe.products.create({ name: "Abbonamento biennale" });

        const price = await stripe.prices.create({
            unit_amount: await computePriceInCents(user.plan, user.billingType, await getReferralDiscount()),
            currency: "eur",
            recurring: { interval: "month", interval_count: billingData[user.billingType]?.durationM },
            product: product.id,
        });

        // 3. Crea Subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            expand: ["latest_invoice.payment_intent"],
            payment_behavior: "default_incomplete", // necessario per completare il pagamento con PaymentIntent
        });

        // 4. Restituisci client_secret per completare il pagamento lato client
        const paymentIntent = subscription.latest_invoice.payment_intent;

        return NextResponse.json({ client_secret: paymentIntent.client_secret, subscriptionId: subscription.id });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
