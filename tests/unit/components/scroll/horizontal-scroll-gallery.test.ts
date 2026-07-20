import { describe, it, expect } from "vitest";
import {
    closestIndexToCenter,
    scaleForOffset,
    opacityForOffset,
    wheelDeltaToScrollLeft,
} from "@/components/scroll/HorizontalScrollGallery";

describe("closestIndexToCenter", () => {
    it("picks the item whose center is nearest the viewport center", () => {
        expect(closestIndexToCenter([100, 300, 500], 290)).toBe(1);
        expect(closestIndexToCenter([100, 300, 500], 0)).toBe(0);
        expect(closestIndexToCenter([100, 300, 500], 1000)).toBe(2);
    });

    it("returns 0 for a single-item list", () => {
        expect(closestIndexToCenter([250], 900)).toBe(0);
    });
});

describe("scaleForOffset", () => {
    it("keeps the active card at full scale", () => {
        expect(scaleForOffset(0)).toBe(1);
    });

    it("shrinks neighboring cards progressively", () => {
        expect(scaleForOffset(1)).toBe(0.96);
        expect(scaleForOffset(-1)).toBe(0.96);
        expect(scaleForOffset(2)).toBe(0.91);
        expect(scaleForOffset(-3)).toBe(0.91);
    });
});

describe("opacityForOffset", () => {
    it("keeps the active card fully opaque and fades the rest", () => {
        expect(opacityForOffset(0)).toBe(1);
        expect(opacityForOffset(1)).toBe(0.78);
        expect(opacityForOffset(2)).toBe(0.52);
    });
});

describe("wheelDeltaToScrollLeft", () => {
    it("adds vertical wheel delta to scrollLeft when vertical intent dominates", () => {
        expect(wheelDeltaToScrollLeft(100, 40, 0)).toBe(140);
    });

    it("adds horizontal delta directly when horizontal intent dominates", () => {
        expect(wheelDeltaToScrollLeft(100, 5, 60)).toBe(160);
    });
});
