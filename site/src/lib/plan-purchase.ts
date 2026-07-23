import "server-only";

import { plansData, isPaidPlan, planRank } from "@/config";
import { recordOnboardingTransition, type OnboardingLifecycleStage } from "@/lib/onboarding-lifecycle";

/**
 * How a plan purchase should route the buyer afterwards.
 *
 * - `first_paid` — the user's first paid plan (from free/unset). Runs the full
 *   post-purchase onboarding (profile → companies → filters → instructions →
 *   review → launch) so the campaign is configured before anything generates.
 * - `reconfigure` — an already-paid user changed tier or topped up capacity, and
 *   nothing is currently generating. An upgrade walks the setup from the
 *   companies step (so newly-unlocked filters/instructions get configured); a
 *   same-tier top-up goes straight to the review hub. Capacity is additive.
 * - `reconfigure_deferred` — same as reconfigure, but a previous campaign is
 *   still generating. We do NOT pull the user into setup (that would hide the
 *   running campaign); entitlements are granted and the intended setup is
 *   stashed in `campaignSetupPending` so the dashboard can offer it on demand.
 *
 * No outcome starts generation at payment time: the user always launches
 * explicitly. Server generation is idempotent (only not-yet-complete companies
 * are processed), so relaunching after a previous run is safe.
 */
export type PlanGrantOutcome = "first_paid" | "reconfigure" | "reconfigure_deferred";

export interface PlanGrant {
  outcome: PlanGrantOutcome;
  /** Fields to merge into the user doc (credits handled separately as an increment). */
  fields: Record<string, unknown>;
  /** Plan credits to grant via FieldValue.increment on the caller side. */
  includedCredits: number;
  /** The post-purchase stage this purchase routes to (analytics + deferred CTA). */
  stage: OnboardingLifecycleStage;
}

/** Count companies that already occupy a capacity slot (have a saved company). */
function countUsedCompanies(resultsData: Record<string, unknown> | undefined): number {
  return Object.entries(resultsData ?? {}).filter(
    ([k, v]: [string, unknown]) =>
      k !== "companies_to_confirm" && typeof v === "object" && v !== null && (v as { company?: unknown }).company
  ).length;
}

/**
 * Whether a previously-launched campaign is still generating: any company that
 * has been started (has a saved `company`) but has no `email_sent` marker yet.
 * Mirrors the server's own completion signal.
 */
export function isGenerationInProgress(resultsData: Record<string, unknown> | undefined): boolean {
  return Object.entries(resultsData ?? {}).some(
    ([k, v]: [string, unknown]) =>
      k !== "companies_to_confirm" &&
      typeof v === "object" && v !== null &&
      (v as { company?: unknown }).company &&
      !Object.prototype.hasOwnProperty.call(v, "email_sent")
  );
}

/**
 * Decide the entitlement update + post-purchase routing for a plan purchase.
 * Pure: no I/O — the caller applies `fields` inside its Firestore transaction
 * and uses `outcome`/`stage` to drive analytics/onboarding side effects.
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
      stage: "post_purchase",
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
  const maxCompanies = newPlanMaxCompanies + Math.max(0, currentMax - countUsedCompanies(args.resultsData));

  // An upgrade unlocks new configuration (filters, custom instructions), so walk
  // the setup from the companies step instead of dropping at the final review —
  // otherwise newly-available fields are never offered. A same-tier top-up has
  // nothing new to configure, so go straight to the review hub.
  const isUpgrade = planRank(args.itemId) > planRank(currentPlan);
  const stage: OnboardingLifecycleStage = isUpgrade ? "post_purchase_companies" : "post_purchase_review";
  const step = isUpgrade ? 7 : 9;

  // A previous campaign is still generating: don't yank the user into setup and
  // hide it. Grant entitlements, keep them on the dashboard, and stash the
  // intended setup for a dashboard banner to offer on demand.
  if (isGenerationInProgress(args.resultsData)) {
    return {
      outcome: "reconfigure_deferred",
      includedCredits,
      stage,
      fields: {
        plan: args.itemId,
        maxCompanies,
        campaignSetupPending: { stage, step, plan: args.itemId },
      },
    };
  }

  return {
    outcome: "reconfigure",
    includedCredits,
    stage,
    fields: {
      plan: args.itemId,
      maxCompanies,
      onboardingStep: step,
      onboardingStage: stage,
      campaignSetupPending: null,
    },
  };
}

/**
 * Record the onboarding transition for a plan purchase (analytics + activity
 * timestamp). Never changes the stage itself — the purchase transaction already
 * wrote it. Mirrors the routing decided by {@link computePlanGrant}.
 */
export async function recordPlanPurchaseTransition(args: {
  grant: PlanGrant;
  userId: string;
  itemId: string;
  userData: Record<string, unknown> | undefined;
  paymentId: string;
}): Promise<void> {
  const { grant } = args;
  const previousStage = args.userData?.onboardingStage as string | undefined;
  const reason =
    grant.outcome === "first_paid" ? "payment_succeeded"
    : grant.outcome === "reconfigure_deferred" ? "plan_reconfigure_deferred"
    : "plan_reconfigure";
  const step =
    grant.outcome === "first_paid" ? 6
    : ((grant.fields.onboardingStep as number | undefined)
       ?? ((grant.fields.campaignSetupPending as { step?: number } | null | undefined)?.step)
       ?? 9);
  await recordOnboardingTransition({
    userId: args.userId,
    from: previousStage ?? (grant.outcome === "first_paid" ? "checkout" : "completed"),
    to: grant.stage,
    flow: "post_purchase",
    step,
    reason,
    metadata: {
      plan: args.itemId,
      previous_plan: (args.userData?.plan as string | undefined) ?? null,
      payment_id: args.paymentId,
      deferred: grant.outcome === "reconfigure_deferred",
    },
    updateStage: false,
  });
}
