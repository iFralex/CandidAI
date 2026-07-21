import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
  completed: new Set(),
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
  const now = FieldValue.serverTimestamp();
  const userRef = adminDb.collection("users").doc(args.userId);
  const eventRef = adminDb.collection("analytics_events").doc();
  const transitionAllowed = isAllowedOnboardingTransition(args.from, args.to);
  const batch = adminDb.batch();

  batch.set(userRef, {
    ...(args.updateStage === false ? {} : {
      onboardingStage: args.to,
      ...(typeof args.step === "number" ? { onboardingStep: args.step } : {}),
    }),
    onboardingStageEnteredAt: now,
    lastOnboardingActivityAt: now,
  }, { merge: true });
  batch.set(eventRef, {
    event: "onboarding_stage_entered",
    params: {
      from_stage: isOnboardingStage(args.from) ? args.from : "unknown",
      to_stage: args.to,
      flow: args.flow,
      reason: args.reason ?? "user_progress",
      transition_allowed: transitionAllowed,
      ...(args.metadata ?? {}),
    },
    user_id: args.userId,
    session_id: null,
    page_path: "/dashboard",
    timestamp: now,
    source: "server",
  });
  await batch.commit();
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
