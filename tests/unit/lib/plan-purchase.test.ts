import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding-lifecycle", () => ({
  recordOnboardingTransition: vi.fn(),
}));

import { computePlanGrant, isGenerationInProgress } from "@/lib/plan-purchase";

describe("plan purchase routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detects a started company until its email marker exists", () => {
    expect(isGenerationInProgress({
      pending: { company: { name: "Acme" }, recruiter: {} },
      complete: { company: { name: "Done" }, email_sent: new Date(0) },
    })).toBe(true);
    expect(isGenerationInProgress({
      complete: { company: { name: "Done" }, email_sent: new Date(0) },
    })).toBe(false);
  });

  it("keeps an upgrade on the dashboard while a generation is active", () => {
    const grant = computePlanGrant({
      itemId: "pro",
      userData: { plan: "base", onboardingStep: 50, maxCompanies: 10 },
      resultsData: { pending: { company: { name: "Acme" } } },
    });

    expect(grant.outcome).toBe("reconfigure_deferred");
    expect(grant.fields).not.toHaveProperty("onboardingStep");
    expect(grant.fields.campaignSetupPending).toMatchObject({
      stage: "post_purchase_companies",
      step: 7,
      plan: "pro",
    });
  });

  it("routes a completed upgrade through companies before filters", () => {
    const grant = computePlanGrant({
      itemId: "pro",
      userData: { plan: "base", onboardingStep: 50, maxCompanies: 10 },
      resultsData: { done: { company: { name: "Acme" }, email_sent: new Date(0) } },
    });

    expect(grant.outcome).toBe("reconfigure");
    expect(grant.fields).toMatchObject({
      onboardingStage: "post_purchase_companies",
      onboardingStep: 7,
    });
  });
});
