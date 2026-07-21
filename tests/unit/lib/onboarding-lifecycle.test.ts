import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

let lifecycle: typeof import("@/lib/onboarding-lifecycle");

beforeAll(async () => {
  lifecycle = await import("@/lib/onboarding-lifecycle");
});

describe("onboarding lifecycle transition policy", () => {
  it("allows the forward free-preview path", () => {
    expect(lifecycle.isAllowedOnboardingTransition("profile_source", "profile_review")).toBe(true);
    expect(lifecycle.isAllowedOnboardingTransition("target_company", "recruiter_search")).toBe(true);
    expect(lifecycle.isAllowedOnboardingTransition("email_generation", "preview_ready")).toBe(true);
  });

  it("allows intentional editing/back-navigation paths", () => {
    expect(lifecycle.isAllowedOnboardingTransition("profile_review", "profile_source")).toBe(true);
    expect(lifecycle.isAllowedOnboardingTransition("post_purchase_review", "post_purchase_filters")).toBe(true);
    expect(lifecycle.isAllowedOnboardingTransition("checkout", "preview_ready")).toBe(true);
  });

  it("flags impossible jumps without treating unknown legacy state as invalid", () => {
    expect(lifecycle.isAllowedOnboardingTransition("profile_source", "completed")).toBe(false);
    expect(lifecycle.isAllowedOnboardingTransition("completed", "checkout")).toBe(false);
    expect(lifecycle.isAllowedOnboardingTransition("legacy_step_4", "target_company")).toBe(true);
  });
});
