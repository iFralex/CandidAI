// app/api/stripe-webhook/route.ts
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { plansInfo, CREDIT_PACKAGES } from "@/config";
import { FieldValue } from "firebase-admin/firestore";
import { recordPaymentSuccess } from "@/lib/server-track";
import { incrementDiscountUsage } from "@/lib/discount-codes";
import { computePlanGrant, recordPlanPurchaseTransition, type PlanGrant } from "@/lib/plan-purchase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-11-17.clover" });

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook signature configuration is missing", { status: 400 });
  }

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
      const { userId, purchaseType, itemId, discountCode: rawDiscountCode } = paymentIntent.metadata;
      const discountCode = rawDiscountCode || null;

      if (!userId) {
        return new Response("Webhook Error: missing userId in metadata", { status: 400 });
      }

      const userRef = adminDb.collection("users").doc(userId);
      const paymentRef = userRef.collection("payments").doc(paymentIntent.id);

      // Race-safe idempotency: stripe-webhook and /api/payment-confirm can
      // both fire for the same payment within milliseconds. A non-transactional
      // exists-then-set check let both pass and double-incremented credits +
      // discount usage. Use a Firestore transaction so the existence check
      // and the side-effecting writes happen atomically; if the doc already
      // exists at commit time, the transaction's other writes never apply.
      const planGrantRef: { value: PlanGrant | null } = { value: null };
      let alreadyProcessed = false;

      // Pre-fetch out-of-transaction reads that don't need atomicity
      // (these only inform the writes inside the transaction).
      let userSnapData: Record<string, any> | undefined;
      let resultsData: Record<string, any> | undefined;
      if (purchaseType === "plan") {
        const [userSnap, resultsSnap] = await Promise.all([
          userRef.get(),
          adminDb.collection("users").doc(userId).collection("data").doc("results").get(),
        ]);
        userSnapData = userSnap.data();
        resultsData = resultsSnap.exists ? (resultsSnap.data() ?? {}) : {};
      }

      await adminDb.runTransaction(async (tx) => {
        const existing = await tx.get(paymentRef);
        if (existing.exists) { alreadyProcessed = true; return; }

        tx.set(paymentRef, {
          type: "one_time",
          purchaseType,
          itemId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          payment_method: paymentIntent.payment_method,
          discountCode: discountCode ?? null,
          createdAt: new Date(),
        });

        if (purchaseType === "credits") {
          const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
          if (!pkg) throw new Error("Pacchetto crediti non trovato");
          tx.update(userRef, { credits: FieldValue.increment(pkg.credits) });
        } else if (purchaseType === "plan") {
          const plan = plansInfo.find((p) => p.id === itemId);
          if (!plan) throw new Error("Piano non trovato");
          const grant = computePlanGrant({ itemId, userData: userSnapData, resultsData });
          planGrantRef.value = grant;
          tx.update(userRef, {
            ...grant.fields,
            credits: FieldValue.increment(grant.includedCredits),
          });
        }
      });

      if (alreadyProcessed) {
        return new Response("ok (already processed)", { status: 200 });
      }

      // Side effects below are run AT MOST ONCE per payment because the
      // transaction above is atomic — if a concurrent caller wrote the
      // paymentRef first, this request short-circuits via alreadyProcessed.
      if (discountCode) {
        await incrementDiscountUsage(discountCode);
      }

      await recordPaymentSuccess({
        userId,
        purchaseType,
        itemId,
        amountCents: paymentIntent.amount,
        currency: paymentIntent.currency,
        isOnboarding: planGrantRef.value?.outcome === "first_paid",
        source: "webhook",
      });
      if (purchaseType === "plan" && planGrantRef.value) {
        await recordPlanPurchaseTransition({ grant: planGrantRef.value, userId, itemId, userData: userSnapData, paymentId: paymentIntent.id });
      }

      // No startServer at payment time: the buyer launches explicitly from the
      // post-purchase flow (idempotent generation).

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
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": process.env.SESSION_API_KEY ?? "",
          },
          body: JSON.stringify({
            userId,
            type: "purchase-confirmation",
            dedupeKey: `purchase-confirmation:${paymentIntent.id}`,
            category: "transactional",
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
