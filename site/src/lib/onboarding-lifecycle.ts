import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { analyticsDay, metricKey } from "@/lib/analytics-aggregates";

export const ONBOARDING_STAGES = [
  "profile_source",
  "profile_review",
  "target_company",
  "recruiter_search",
  "recruiter_found",
  "email_generation",
  "preview_ready",
  "checkout",
  "post_purchase",
  "post_purchase_profile",
  "post_purchase_companies",
  "post_purchase_filters",
  "post_purchase_instructions",
  "post_purchase_review",
  "completed",
] as const;

export type OnboardingLifecycleStage = (typeof ONBOARDING_STAGES)[number];

const ALLOWED: Record<OnboardingLifecycleStage, Set<OnboardingLifecycleStage>> = {
  profile_source: new Set(["profile_review", "target_company"]),
  profile_review: new Set(["profile_source", "target_company"]),
  target_company: new Set(["profile_review", "recruiter_search"]),
  recruiter_search: new Set(["target_company", "recruiter_found"]),
  recruiter_found: new Set(["recruiter_search", "email_generation"]),
  email_generation: new Set(["recruiter_found", "preview_ready"]),
  preview_ready: new Set(["checkout", "completed"]),
  checkout: new Set(["preview_ready", "post_purchase"]),
  post_purchase: new Set(["post_purchase_profile"]),
  post_purchase_profile: new Set(["post_purchase", "post_purchase_companies", "post_purchase_review"]),
  post_purchase_companies: new Set(["post_purchase_profile", "post_purchase_filters", "post_purchase_instructions", "post_purchase_review"]),
  post_purchase_filters: new Set(["post_purchase_companies", "post_purchase_instructions", "post_purchase_review"]),
  post_purchase_instructions: new Set(["post_purchase_companies", "post_purchase_filters", "post_purchase_review"]),
  post_purchase_review: new Set(["post_purchase_profile", "post_purchase_companies", "post_purchase_filters", "post_purchase_instructions", "completed"]),
  // An already-completed paid user who buys another plan re-enters the review
  // hub to configure newly-unlocked features and add companies before relaunch.
  completed: new Set(["post_purchase_review"]),
};

export function isOnboardingStage(value: unknown): value is OnboardingLifecycleStage {
  return typeof value === "string" && (ONBOARDING_STAGES as readonly string[]).includes(value);
}

export function isAllowedOnboardingTransition(from: unknown, to: OnboardingLifecycleStage): boolean {
  if (!isOnboardingStage(from)) return true;
  return from === to || ALLOWED[from].has(to);
}

export async function recordOnboardingTransition(args: {
  userId: string;
  from?: unknown;
  to: OnboardingLifecycleStage;
  flow: "free_preview" | "post_purchase" | "legacy";
  step?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  updateStage?: boolean;
}): Promise<void> {
  const userRef = adminDb.collection("users").doc(args.userId);
  const eventRef = adminDb.collection("analytics_events").doc();
  const firstEntryRef = adminDb.collection("onboarding_stage_entries").doc(`${args.userId}__${args.to}`);
  const dailyRef = adminDb.collection("analytics_daily").doc(analyticsDay());
  const transitionAllowed = isAllowedOnboardingTransition(args.from, args.to);
  await adminDb.runTransaction(async tx => {
    const [userSnap, firstEntrySnap] = await Promise.all([tx.get(userRef), tx.get(firstEntryRef)]);
    const communication = userSnap.data()?.lastLifecycleCommunication;
    const engagement = userSnap.data()?.lastCommunicationEngagement;
    const sentAt = communication?.sentAt instanceof Timestamp ? communication.sentAt.toMillis() : Date.parse(String(communication?.sentAt ?? ""));
    const ageMs = Number.isFinite(sentAt) ? Date.now() - sentAt : Number.POSITIVE_INFINITY;
    const attributed = ageMs >= 0 && ageMs <= 72 * 60 * 60_000;
    const attributionModel = engagement?.dedupeKey === communication?.dedupeKey && engagement?.event === "clicked"
      ? "click_through"
      : "view_through";
    const attributionRef = attributed
      ? adminDb.collection("communication_attributions").doc(`${args.userId}__${metricKey(String(communication.dedupeKey ?? "unknown"))}`)
      : null;
    const attributionSnap = attributionRef ? await tx.get(attributionRef) : null;
    const attribution = attributed ? {
      communication_type: communication.type ?? "unknown",
      communication_category: communication.category ?? "unknown",
      communication_dedupe_key: communication.dedupeKey ?? "unknown",
      communication_age_ms: ageMs,
      attribution_window_hours: 72,
      attribution_model: attributionModel,
    } : {};

    tx.set(userRef, {
      ...(args.updateStage === false ? {} : {
        onboardingStage: args.to,
        onboardingStageEnteredAt: FieldValue.serverTimestamp(),
        ...(typeof args.step === "number" ? { onboardingStep: args.step } : {}),
      }),
      lastOnboardingActivityAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(eventRef, {
      event: "onboarding_stage_entered",
      params: {
        from_stage: isOnboardingStage(args.from) ? args.from : "unknown",
        to_stage: args.to,
        flow: args.flow,
        reason: args.reason ?? "user_progress",
        transition_allowed: transitionAllowed,
        ...attribution,
        ...(args.metadata ?? {}),
      },
      user_id: args.userId,
      session_id: null,
      page_path: "/dashboard",
      timestamp: FieldValue.serverTimestamp(),
      source: "server",
    });
    if (!firstEntrySnap.exists) {
      tx.create(firstEntryRef, {
        userId: args.userId,
        stage: args.to,
        flow: args.flow,
        firstEnteredAt: FieldValue.serverTimestamp(),
      });
      tx.set(dailyRef, {
        [`onboarding_stage_${metricKey(args.to)}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (attributed && !firstEntrySnap.exists) {
      tx.set(dailyRef, {
        [`attributed_stage_${metricKey(args.to)}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (attributed && attributionRef && !attributionSnap?.exists) {
      tx.create(attributionRef, {
        userId: args.userId,
        dedupeKey: communication.dedupeKey ?? "unknown",
        type: communication.type ?? "unknown",
        category: communication.category ?? "unknown",
        firstAttributedStage: args.to,
        attributedAt: FieldValue.serverTimestamp(),
        ageMs,
        model: attributionModel,
      });
      tx.set(dailyRef, {
        [`attributed_communication_${metricKey(String(communication.type ?? "unknown"))}`]: FieldValue.increment(1),
        [`attributed_age_ms_${metricKey(String(communication.type ?? "unknown"))}`]: FieldValue.increment(ageMs),
        communications_attributed: FieldValue.increment(1),
        communications_attributed_age_ms: FieldValue.increment(ageMs),
        [`communications_attributed_${attributionModel}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

export async function recordOnboardingSignal(args: {
  event: string;
  userId: string;
  stage?: OnboardingLifecycleStage | string;
  params?: Record<string, unknown>;
}): Promise<void> {
  await adminDb.collection("analytics_events").add({
    event: args.event,
    params: { ...(args.stage ? { stage: args.stage } : {}), ...(args.params ?? {}) },
    user_id: args.userId,
    session_id: null,
    page_path: "/dashboard",
    timestamp: FieldValue.serverTimestamp(),
    source: "server",
  });
}
