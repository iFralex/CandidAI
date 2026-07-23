import "server-only";

import { plansData, isPaidPlan } from "@/config";
import { recordOnboardingTransition } from "@/lib/onboarding-lifecycle";

/**
 * How a plan purchase should route the buyer afterwards.
 *
 * - `first_paid`  — the user's first paid plan (from free/unset). Runs the full
 *   post-purchase onboarding (profile → companies → filters → instructions →
 *   review → launch) so the campaign is configured before anything generates.
 * - `reconfigure` — an already-paid user changed tier or topped up capacity.
 *   Drops them into the review hub to configure any newly-unlocked features and
 *   add companies, then launch explicitly. Capacity carries over (additive).
 *
 * Neither outcome starts generation at payment time: the user always launches
 * explicitly from the post-purchase flow. Server-side generation is idempotent
 * (it only processes not-yet-complete companies), so relaunching is safe.
 */
export type PlanGrantOutcome = "first_paid" | "reconfigure";

export interface PlanGrant {
  outcome: PlanGrantOutcome;
  /** Fields to merge into the user doc (credits handled separately as an increment). */
  fields: Record<string, unknown>;
  /** Plan credits to grant via FieldValue.increment on the caller side. */
  includedCredits: number;
}

/** Count companies that already occupy a capacity slot (have a saved company). */
function countUsedCompanies(resultsData: Record<string, unknown> | undefined): number {
  return Object.entries(resultsData ?? {}).filter(
    ([k, v]: [string, unknown]) =>
      k !== "companies_to_confirm" && typeof v === "object" && v !== null && (v as { company?: unknown }).company
  ).length;
}

/**
 * Decide the entitlement update + post-purchase routing for a plan purchase.
 * Pure: no I/O — the caller applies `fields` inside its Firestore transaction
 * and uses `outcome` to drive analytics/onboarding side effects.
 */
export function computePlanGrant(args: {
  itemId: string;
  userData: Record<string, unknown> | undefined;
  resultsData: Record<string, unknown> | undefined;
}): PlanGrant {
  const planData = plansData[args.itemId as keyof typeof plansData];
  const includedCredits = planData?.credits ?? 0;
  const newPlanMaxCompanies = planData?.maxCompanies ?? 0;

  const currentOnboardingStep = (args.userData?.onboardingStep as number | undefined) ?? 50;
  const currentPlan = args.userData?.plan as string | undefined;

  // First paid plan: still inside the initial funnel (step < 10) OR coming from
  // a free/unset plan — even from the dashboard, where step is already ≥ 10.
  const firstPaid = currentOnboardingStep < 10 || !isPaidPlan(currentPlan);

  if (firstPaid) {
    return {
      outcome: "first_paid",
      includedCredits,
      fields: {
        plan: args.itemId,
        maxCompanies: newPlanMaxCompanies,
        onboardingStep: 6,
        onboardingStage: "post_purchase",
      },
    };
  }

  // Already paid → paid: stack any unused capacity onto the new plan's capacity.
  const currentMax = (args.userData?.maxCompanies as number | undefined) ?? 0;
  const remaining = Math.max(0, currentMax - countUsedCompanies(args.resultsData));

  return {
    outcome: "reconfigure",
    includedCredits,
    fields: {
      plan: args.itemId,
      maxCompanies: newPlanMaxCompanies + remaining,
      onboardingStep: 9,
      onboardingStage: "post_purchase_review",
    },
  };
}

/**
 * Record the onboarding transition for a plan purchase (analytics + activity
 * timestamp). Never changes the stage itself — the purchase transaction already
 * wrote it. Mirrors the routing decided by {@link computePlanGrant}.
 */
export async function recordPlanPurchaseTransition(args: {
  outcome: PlanGrantOutcome;
  userId: string;
  itemId: string;
  userData: Record<string, unknown> | undefined;
  paymentId: string;
}): Promise<void> {
  const previousStage = args.userData?.onboardingStage as string | undefined;
  if (args.outcome === "first_paid") {
    await recordOnboardingTransition({
      userId: args.userId,
      from: previousStage ?? "checkout",
      to: "post_purchase",
      flow: "post_purchase",
      step: 6,
      reason: "payment_succeeded",
      metadata: { plan: args.itemId, payment_id: args.paymentId },
      updateStage: false,
    });
    return;
  }
  await recordOnboardingTransition({
    userId: args.userId,
    from: previousStage ?? "completed",
    to: "post_purchase_review",
    flow: "post_purchase",
    step: 9,
    reason: "plan_reconfigure",
    metadata: {
      plan: args.itemId,
      previous_plan: (args.userData?.plan as string | undefined) ?? null,
      payment_id: args.paymentId,
    },
    updateStage: false,
  });
}
