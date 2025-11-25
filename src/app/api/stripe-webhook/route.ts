import Stripe from "stripe";
import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { billingData } from "@/config";
import { startServer } from "@/actions/onboarding-actions";
import { Timestamp } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer;
      const paymentIntentId = invoice.payment_intent;

      // Recupera PaymentIntent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Solo se pagamento completato
      if (paymentIntent.status === "succeeded") {
        // Recupera userId dal metadata del customer
        const customer = await stripe.customers.retrieve(customerId);
        const userId = customer.metadata.userId;
        if (!userId) throw new Error("userId non trovato nel metadata del customer");

        const batch = adminDb.batch();

        const paymentRef = adminDb
          .collection("users")
          .doc(userId)
          .collection("payments")
          .doc(subscriptionId);

        const userRef = adminDb.collection("users").doc(userId);

        // Calcola endDate
        const userDoc = await userRef.get();
        const user = userDoc.data();
        if (!user) throw new Error("Utente non trovato in Firestore");

        let endDate: Date;
        if (user.billingType === "lifetime") {
          endDate = new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000); // 20 anni
        } else {
          const months = billingData[user.billingType]?.durationM;
          if (!months) throw new Error("Durata abbonamento non definita");
          endDate = new Date();
          endDate.setMonth(endDate.getMonth() + months);
        }

        batch.set(paymentRef, {
          type: "recurring",
          subscriptionId,
          priceId: invoice.lines.data[0]?.price?.id || null,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          payment_method: paymentIntent.payment_method,
          createdAt: new Date(),
          planId: user.plan,
          billingType: user.billingType,
        });

        batch.update(userRef, {
          expirate: Timestamp.fromDate(endDate),
          onboardingStep: 50
        });

        await batch.commit();
        await startServer();
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return new Response("internal_error", { status: 500 });
  }
}
