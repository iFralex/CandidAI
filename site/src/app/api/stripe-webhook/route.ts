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

      if (!userId) {
        return new Response("Webhook Error: missing userId in metadata", { status: 400 });
      }

      const userRef = adminDb.collection("users").doc(userId);
      const paymentRef = userRef.collection("payments").doc(paymentIntent.id);

      // Idempotency: skip if already processed
      const existingPayment = await paymentRef.get();
      if (existingPayment.exists) {
        return new Response("ok", { status: 200 });
      }

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
        const newPlanMaxCompanies = planData?.maxCompanies || 0;

        // Compute how many companies the user has already used so we can carry
        // over the unused remainder when re-purchasing or upgrading a plan.
        const [userSnap, resultsSnap] = await Promise.all([
          userRef.get(),
          adminDb.collection("users").doc(userId).collection("data").doc("results").get(),
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
          onboardingStep: currentOnboardingStep === 6 ? 7 : 50,
        });
      }

      await batch.commit();

      if (purchaseType === "plan") {
        try {
          await startServer(userId);
        } catch (serverErr) {
          console.error("Failed to start server:", serverErr);
        }
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
        void fetch(`${domain}/api/send-email`, {
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
