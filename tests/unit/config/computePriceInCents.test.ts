import { describe, it, expect } from "vitest";
import { computePriceInCents } from "@/lib/utils";

describe("computePriceInCents", () => {
  describe("plan purchase type", () => {
    it("returns 0 for free_trial plan", () => {
      expect(computePriceInCents("plan", "free_trial")).toBe(0);
    });

    it("returns 3000 for base plan (€30.00)", () => {
      expect(computePriceInCents("plan", "base")).toBe(3000);
    });

    it("returns 6900 for pro plan (€69.00)", () => {
      expect(computePriceInCents("plan", "pro")).toBe(6900);
    });

    it("returns 13900 for ultra plan (€139.00)", () => {
      expect(computePriceInCents("plan", "ultra")).toBe(13900);
    });

    it("throws Error for unknown plan id", () => {
      expect(() => computePriceInCents("plan", "unknown_plan")).toThrow(Error);
    });
  });

  describe("credits purchase type", () => {
    it("returns 1000 for pkg_1000 (€10.00)", () => {
      expect(computePriceInCents("credits", "pkg_1000")).toBe(1000);
    });

    it("returns 2000 for pkg_2500 (€20.00)", () => {
      expect(computePriceInCents("credits", "pkg_2500")).toBe(2000);
    });

    it("returns 3000 for pkg_5000 (€30.00)", () => {
      expect(computePriceInCents("credits", "pkg_5000")).toBe(3000);
    });

    it("throws Error for unknown credit package pkg_9999", () => {
      expect(() => computePriceInCents("credits", "pkg_9999")).toThrow(Error);
    });
  });

  describe("invalid inputs", () => {
    it("throws TypeError when purchaseType is undefined", () => {
      // @ts-expect-error testing invalid runtime input
      expect(() => computePriceInCents(undefined, "base")).toThrow(TypeError);
    });

    it("all returned values are whole number integers (no floats)", () => {
      const values = [
        computePriceInCents("plan", "free_trial"),
        computePriceInCents("plan", "base"),
        computePriceInCents("plan", "pro"),
        computePriceInCents("plan", "ultra"),
        computePriceInCents("credits", "pkg_1000"),
        computePriceInCents("credits", "pkg_2500"),
        computePriceInCents("credits", "pkg_5000"),
      ];
      values.forEach((v) => {
        expect(Number.isInteger(v)).toBe(true);
      });
    });
  });
});
