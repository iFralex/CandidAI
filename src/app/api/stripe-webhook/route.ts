// app/api/stripe-webhook/route.ts
import Stripe from "stripe";
import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { plansInfo, CREDIT_PACKAGES, plansData } from "@/config";
import { startServer } from "@/actions/onboarding-actions";
import { FieldValue } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { userId, purchaseType, itemId } = paymentIntent.metadata;

      if (!userId) throw new Error("userId non trovato nel metadata del payment intent");

      const userRef = adminDb.collection("users").doc(userId);
      const paymentRef = userRef.collection("payments").doc(paymentIntent.id);

      const batch = adminDb.batch();

      // Write payment record
      batch.set(paymentRef, {
        type: "one_time",
        purchaseType,
        itemId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method: paymentIntent.payment_method,
        createdAt: new Date(),
      });

      if (purchaseType === "credits") {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
        if (!pkg) throw new Error("Pacchetto crediti non trovato");

        batch.update(userRef, {
          credits: FieldValue.increment(pkg.credits),
        });
      } else if (purchaseType === "plan") {
        const plan = plansInfo.find((p) => p.id === itemId);
        if (!plan) throw new Error("Piano non trovato");

        const planData = plansData[itemId as keyof typeof plansData];
        const includedCredits = planData?.credits || 0;
        const maxCompanies = planData?.maxCompanies || 0;

        batch.update(userRef, {
          plan: itemId,
          maxCompanies,
          credits: FieldValue.increment(includedCredits),
          onboardingStep: 50,
        });
      }

      await batch.commit();

      if (purchaseType === "plan") {
        await startServer(userId);
      }

      // Send purchase confirmation email (non-blocking)
      try {
        let receiptUrl: string | null = null;
        if (paymentIntent.latest_charge) {
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
          receiptUrl = charge.receipt_url ?? null;
        }

        const userSnap = await userRef.get();
        const newBalance = userSnap.data()?.credits ?? 0;

        const amountFormatted = `€${(paymentIntent.amount / 100).toFixed(2)}`;
        let itemName: string;
        if (purchaseType === "credits") {
          const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
          itemName = `${pkg?.credits ?? ""} Credits`;
        } else {
          const plan = plansInfo.find((p) => p.id === itemId);
          itemName = `${plan?.name ?? itemId} Plan`;
        }

        const domain = process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.com";
        await fetch(`${domain}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            type: "purchase-confirmation",
            data: { amount: amountFormatted, item: itemName, newBalance, receiptUrl },
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send purchase confirmation email:", emailErr);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("Error handling webhook event:", err);
    return new Response("internal_error", { status: 500 });
  }
}
