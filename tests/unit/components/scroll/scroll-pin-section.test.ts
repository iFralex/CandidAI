import { describe, it, expect } from "vitest";
import { fadeRange } from "@/components/scroll/ScrollPinSection";

describe("fadeRange", () => {
    it("returns 0 before the start of the range", () => {
        expect(fadeRange(0, 0.2, 0.5)).toBe(0);
        expect(fadeRange(0.1, 0.2, 0.5)).toBe(0);
    });

    it("returns 1 at and after the end of the range", () => {
        expect(fadeRange(0.5, 0.2, 0.5)).toBe(1);
        expect(fadeRange(1, 0.2, 0.5)).toBe(1);
    });

    it("interpolates linearly inside the range", () => {
        expect(fadeRange(0.35, 0.2, 0.5)).toBeCloseTo(0.5);
    });

    it("treats an empty range as a hard step at start", () => {
        expect(fadeRange(0.1, 0.3, 0.3)).toBe(0);
        expect(fadeRange(0.3, 0.3, 0.3)).toBe(1);
    });
});
