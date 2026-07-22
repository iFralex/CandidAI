import { describe, it, expect } from "vitest";
import { charactersToReveal } from "@/components/landing-apple";

describe("charactersToReveal", () => {
    it("reveals nothing before the reveal window starts", () => {
        expect(charactersToReveal(0.2, 100, 0.3, 0.75)).toBe(0);
    });

    it("reveals everything after the reveal window ends", () => {
        expect(charactersToReveal(0.9, 100, 0.3, 0.75)).toBe(100);
    });

    it("reveals proportionally inside the window", () => {
        expect(charactersToReveal(0.525, 100, 0.3, 0.75)).toBe(50);
    });
});
