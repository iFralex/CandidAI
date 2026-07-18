import { describe, expect, it } from "vitest";
import {
    chooseVariant,
    EXPERIMENTS,
    isExperimentMeasurable,
    parseExperimentAssignments,
    resolveExperiments,
    serializeExperimentAssignments,
} from "@/lib/experiments";

describe("experiments", () => {
    it("chooses weighted variants deterministically at the boundaries", () => {
        expect(chooseVariant("landing_redesign_v1", 0)).toBe("control");
        expect(chooseVariant("landing_redesign_v1", 0.4999)).toBe("control");
        expect(chooseVariant("landing_redesign_v1", 0.5)).toBe("redesign");
        expect(chooseVariant("landing_redesign_v1", 0.9999)).toBe("redesign");
    });

    it("round-trips and sanitizes assignment cookies", () => {
        const raw = serializeExperimentAssignments({ landing_redesign_v1: "redesign" });
        expect(parseExperimentAssignments(raw)).toEqual({ landing_redesign_v1: "redesign" });
        expect(parseExperimentAssignments(encodeURIComponent(JSON.stringify({
            landing_redesign_v1: "invalid",
            unknown_experiment: "control",
        })))).toEqual({});
    });

    it("does not assign draft experiments to production traffic", () => {
        expect(resolveExperiments({ pathname: "/", random: () => 0.8 })).toEqual({
            assignments: {},
            changed: false,
        });
    });

    it("allows a valid development override for a draft", () => {
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
