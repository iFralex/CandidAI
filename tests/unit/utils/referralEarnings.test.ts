import { describe, it, expect } from "vitest";
import { computeReferralEarnings } from "@/lib/referral";
import { computePriceInCents } from "@/lib/utils";

describe("computeReferralEarnings", () => {
  it("returns 0 for 0 purchases", () => {
    expect(computeReferralEarnings(0, 10000).totalCents).toBe(0);
  });

  it("applies only the 5% tier up to 5 purchases", () => {
    expect(computeReferralEarnings(5, 10000).totalCents).toBe(2500);
  });

  it("adds the 10% tier starting at the 6th purchase", () => {
    expect(computeReferralEarnings(6, 10000).totalCents).toBe(3500);
  });

  it("fills the 10% tier completely at 15 purchases", () => {
    expect(computeReferralEarnings(15, 10000).totalCents).toBe(12500);
  });

  it("adds the 15% tier starting at the 16th purchase", () => {
    expect(computeReferralEarnings(16, 10000).totalCents).toBe(14000);
  });

  it("fills the 15% tier completely at 30 purchases", () => {
    expect(computeReferralEarnings(30, 10000).totalCents).toBe(35000);
  });

  it("adds the 20% tier starting at the 31st purchase, and it never stops", () => {
    expect(computeReferralEarnings(31, 10000).totalCents).toBe(37000);
    expect(computeReferralEarnings(100, 10000).totalCents).toBe(175000);
  });

  it("clamps negative or fractional counts down to a safe integer", () => {
    expect(computeReferralEarnings(-5, 10000).totalCents).toBe(0);
    expect(computeReferralEarnings(5.9, 10000).totalCents).toBe(2500);
  });

  it("matches a real plan price end-to-end (Pro, 20 purchases)", () => {
    const priceCents = computePriceInCents("plan", "pro");
    expect(computeReferralEarnings(20, priceCents).totalCents).toBe(9800);
  });

  it("breaks down earnings per tier, including empty tiers", () => {
    const { breakdown } = computeReferralEarnings(6, 10000);
    expect(breakdown).toHaveLength(4);
    expect(breakdown[0]).toMatchObject({ count: 5, subtotalCents: 2500 });
    expect(breakdown[1]).toMatchObject({ count: 1, subtotalCents: 1000 });
    expect(breakdown[2]).toMatchObject({ count: 0, subtotalCents: 0 });
    expect(breakdown[3]).toMatchObject({ count: 0, subtotalCents: 0 });
  });
});
