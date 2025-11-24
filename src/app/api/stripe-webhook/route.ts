// app/api/stripe-webhook/route.js
import Stripe from "stripe";
import { headers } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req) {
  const body = await req.text();
  const sig = headers().get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // Aggiorna sessione in Firebase
        /*await db.ref(`stripe_sessions/${session.id}`).update({
          status: "completed",
          customerId: session.customer,
          payment_status: session.payment_status,
          updatedAt: Date.now(),
        });*/
        break;
      }

      case "customer.subscription.created":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        // Salva informazioni principali
        /*await db.ref(`subscriptions/${subscription.id}`).set({
          customerId: subscription.customer,
          status: subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          created: subscription.created,
          plan: subscription.items?.data?.[0]?.price || null,
          metadata: subscription.metadata || {},
          updatedAt: Date.now(),
        });*/
        break;
      }

      default:
        // altri eventi di interesse
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return new Response("internal_error", { status: 500 });
  }
}
