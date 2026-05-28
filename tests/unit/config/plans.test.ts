import { describe, it, expect } from "vitest";
import { plansInfo, plansData, CREDIT_PACKAGES } from "@/config";

describe("PLANS Constants Structure", () => {
  describe("plansInfo structure", () => {
    it("every plan has properties: id, name, price", () => {
      plansInfo.forEach((plan) => {
        expect(plan).toHaveProperty("id");
        expect(plan).toHaveProperty("name");
        expect(plan).toHaveProperty("price");
      });
    });

    it("every plan id in plansInfo has a corresponding entry in plansData with maxCompanies and credits", () => {
      plansInfo.forEach((plan) => {
        const data = plansData[plan.id as keyof typeof plansData];
        expect(data).toBeDefined();
        expect(data).toHaveProperty("maxCompanies");
        expect(data).toHaveProperty("credits");
      });
    });
  });

  describe("plansData specific values", () => {
    it("free_trial.maxCompanies === 1", () => {
      expect(plansData.free_trial.maxCompanies).toBe(1);
    });

    it("pro.credits === 1000", () => {
      expect(plansData.pro.credits).toBe(1000);
    });

    it("ultra.credits === 2500", () => {
      expect(plansData.ultra.credits).toBe(2500);
    });
  });

  describe("CREDIT_PACKAGES", () => {
    it("has exactly 3 elements", () => {
      expect(CREDIT_PACKAGES).toHaveLength(3);
    });
  });

  describe("recruiter email reveal feature", () => {
    it("revealRecruiterEmail is false for free_trial and true for paid plans", () => {
      expect(plansData.free_trial.revealRecruiterEmail).toBe(false);
      expect(plansData.base.revealRecruiterEmail).toBe(true);
      expect(plansData.pro.revealRecruiterEmail).toBe(true);
      expect(plansData.ultra.revealRecruiterEmail).toBe(true);
    });

    it("free_trial features do NOT mention the recruiter email", () => {
      const free = plansInfo.find((p) => p.id === "free_trial")!;
      expect(free.features.some((f) => /recruiter.*email/i.test(f))).toBe(false);
    });

    it("every paid plan lists the recruiter email feature", () => {
      ["base", "pro", "ultra"].forEach((id) => {
        const plan = plansInfo.find((p) => p.id === id)!;
        expect(plan.features.some((f) => /recruiter.*email/i.test(f))).toBe(true);
      });
    });
  });
});
