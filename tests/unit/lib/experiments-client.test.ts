import { beforeEach, describe, expect, it } from "vitest";
import {
    getVisitorId,
    isExperimentQaSession,
    markExperimentExposed,
} from "@/lib/experiments-client";

describe("experiments client", () => {
    beforeEach(() => {
        document.cookie = "_ca_vid=; Max-Age=0; path=/";
        document.cookie = "_ca_exp_qa=; Max-Age=0; path=/";
        localStorage.clear();
        window.__caExperimentContext = undefined;
    });

    it("reads the stable visitor and QA markers", () => {
        document.cookie = "_ca_vid=visitor-123; path=/";
        document.cookie = "_ca_exp_qa=1; path=/";
        expect(getVisitorId()).toBe("visitor-123");
        expect(isExperimentQaSession()).toBe(true);
    });

    it("deduplicates exposure and stores structured metadata", () => {
        document.cookie = "_ca_vid=visitor-123; path=/";
        const context = [{ id: "landing_redesign_v1" as const, variant: "control", source: "server" as const }];
        expect(markExperimentExposed(context)).toHaveLength(1);
        expect(markExperimentExposed(context)).toHaveLength(0);
        const stored = JSON.parse(localStorage.getItem("_ca_exp_seen_landing_redesign_v1_control")!);
        expect(stored).toMatchObject({ visitorId: "visitor-123", version: 1, pagePath: "/" });
    });
});
