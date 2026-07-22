import { describe, expect, it } from "vitest";
import {
    chooseVariant,
    EXPERIMENTS,
    isExperimentMeasurable,
    isValidVariant,
    parseExperimentAssignments,
    resolveExperiments,
    serializeExperimentAssignments,
} from "@/lib/experiments";

describe("experiments", () => {
    it("chooses weighted variants deterministically at the boundaries", () => {
        expect(chooseVariant("landing_redesign_v1", 0)).toBe("control");
        expect(chooseVariant("landing_redesign_v1", 0.3399)).toBe("control");
        expect(chooseVariant("landing_redesign_v1", 0.34)).toBe("redesign");
        expect(chooseVariant("landing_redesign_v1", 0.6699)).toBe("redesign");
        expect(chooseVariant("landing_redesign_v1", 0.67)).toBe("apple");
        expect(chooseVariant("landing_redesign_v1", 0.9999)).toBe("apple");
    });

    it("round-trips and sanitizes assignment cookies", () => {
        const raw = serializeExperimentAssignments({ landing_redesign_v1: "redesign" });
        expect(parseExperimentAssignments(raw)).toEqual({ landing_redesign_v1: "redesign" });
        expect(parseExperimentAssignments(encodeURIComponent(JSON.stringify({
            landing_redesign_v1: "invalid",
            unknown_experiment: "control",
        })))).toEqual({});
    });

    it("accepts apple as a valid variant for landing_redesign_v1", () => {
        expect(isValidVariant("landing_redesign_v1", "apple")).toBe(true);
    });

    it("does not assign draft experiments to production traffic", () => {
        expect(resolveExperiments({ pathname: "/", random: () => 0.8 })).toEqual({
            assignments: {},
            changed: false,
        });
    });

    it("allows an explicit override for a draft in any environment", () => {
        const overrides = new URLSearchParams("ca_exp_landing_redesign_v1=redesign");
        expect(resolveExperiments({
            pathname: "/",
            overrides,
            allowOverrides: true,
        })).toEqual({
            assignments: { landing_redesign_v1: "redesign" },
            changed: true,
        });
    });

    it("keeps an existing stable assignment", () => {
        const cookieValue = serializeExperimentAssignments({ landing_redesign_v1: "control" });
        expect(resolveExperiments({ pathname: "/", cookieValue })).toEqual({
            assignments: { landing_redesign_v1: "control" },
            changed: false,
        });
    });

    it("keeps every experiment definition statistically and operationally valid", () => {
        for (const [id, definition] of Object.entries(EXPERIMENTS)) {
            expect(id).toMatch(/^[a-z0-9_]+_v\d+$/);
            expect(Object.keys(definition.variants).length).toBeGreaterThanOrEqual(2);
            expect(Object.values(definition.variants).reduce((sum, weight) => sum + weight, 0)).toBeGreaterThan(0);
            expect(definition.allocationPercent).toBeGreaterThan(0);
            expect(definition.allocationPercent).toBeLessThanOrEqual(100);
            expect(definition.conversionWindowDays).toBeGreaterThan(0);
            expect(definition.observationWindowDays).toBeGreaterThanOrEqual(definition.conversionWindowDays);
            expect(definition.minimumSamplePerVariant).toBeGreaterThan(0);
            expect(definition.hypothesis.length).toBeGreaterThan(20);
        }
    });

    it("does not measure draft experiments outside QA", () => {
        expect(isExperimentMeasurable("landing_redesign_v1")).toBe(false);
    });
});
