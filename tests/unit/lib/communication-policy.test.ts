import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

let evaluate: typeof import("@/lib/communication-service").evaluateCommunicationEligibility;

beforeAll(async () => {
  ({ evaluateCommunicationEligibility: evaluate } = await import("@/lib/communication-service"));
});

describe("communication eligibility", () => {
  it("keeps transactional mail independent from marketing consent", () => {
    expect(evaluate({ category: "transactional", unsubscribed: true, preferences: { marketingEmails: false } })).toEqual({ send: true });
  });

  it("respects separate onboarding and marketing preferences", () => {
    expect(evaluate({ category: "onboarding", preferences: { onboardingReminders: false } }).reason).toBe("preference");
    expect(evaluate({ category: "marketing", preferences: { marketingEmails: false } }).reason).toBe("preference");
  });

  it("applies the 48-hour lifecycle cooldown but not to operational mail", () => {
    const now = Date.now();
    expect(evaluate({ category: "onboarding", nowMs: now, lastLifecycleEmailSentAtMs: now - 60_000 }).reason).toBe("cooldown");
    expect(evaluate({ category: "operational", nowMs: now, lastLifecycleEmailSentAtMs: now - 60_000 })).toEqual({ send: true });
  });

  it("suppresses all sends after a provider suppression until the address changes", () => {
    expect(evaluate({ category: "transactional", emailDeliverySuppressed: true }).reason).toBe("delivery_suppressed");
  });
});
