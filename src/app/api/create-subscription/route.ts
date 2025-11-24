// app/api/create-subscription/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req) {
  const { email, payment_method_id } = await req.json();

  try {
    // 1. Crea o recupera il Customer
    const customer = await stripe.customers.create({
      email,
      payment_method: payment_method_id,
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // 2. Crea Price dinamico (25€ ogni 2 anni)
    const product = await stripe.products.create({ name: "Abbonamento biennale" });

    const price = await stripe.prices.create({
      unit_amount: 10000,
      currency: "eur",
      recurring: { interval: "year", interval_count: 2 },
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
