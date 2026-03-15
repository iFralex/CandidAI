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
});
