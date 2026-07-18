"use client";

import {
    assignmentsToContext,
    EXPERIMENT_COOKIE,
    EXPERIMENT_QA_COOKIE,
    experimentAppliesToPath,
    isExperimentMeasurable,
    parseExperimentAssignments,
    VISITOR_COOKIE,
    type ExperimentContext,
} from "@/lib/experiments";

declare global {
    interface Window {
        clarity?: (...args: unknown[]) => void;
        __caExperimentContext?: ExperimentContext[];
    }
}

function cookieValue(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.split("; ").find((value) => value.startsWith(`${name}=`));
    return match ? match.split("=").slice(1).join("=") : null;
}

export function getActiveExperimentContext(pathname?: string): ExperimentContext[] {
    if (typeof window === "undefined") return [];
    const context = assignmentsToContext(parseExperimentAssignments(cookieValue(EXPERIMENT_COOKIE)));
    const measurable = context.filter(({ id }) =>
        isExperimentMeasurable(id) || cookieValue(EXPERIMENT_QA_COOKIE) === "1"
    );
    if (!pathname) return measurable;
    return measurable.filter(({ id }) => experimentAppliesToPath(id, pathname));
}

export function getExperimentEventParams(): Record<string, string> {
    const context = getActiveExperimentContext();
    if (context.length === 0) return {};
    return {
        experiment_id: context.map(({ id }) => id).join(","),
        experiment_variant: context.map(({ variant }) => variant).join(","),
        experiment_source: "server",
        experiment_qa: cookieValue(EXPERIMENT_QA_COOKIE) === "1" ? "true" : "false",
        visitor_id: getVisitorId() ?? "unknown",
    };
}

export function getVisitorId(): string | null {
    return cookieValue(VISITOR_COOKIE);
}

export function isExperimentQaSession(): boolean {
    return cookieValue(EXPERIMENT_QA_COOKIE) === "1";
}

export function setClarityExperimentContext(context: ExperimentContext[]): void {
    if (typeof window === "undefined" || context.length === 0) return;
    window.__caExperimentContext = context;
    if (!window.clarity) return;
    window.clarity("set", "experiment_qa", isExperimentQaSession() ? "true" : "false");
    for (const assignment of context) {
        window.clarity("set", "experiment", assignment.id);
        window.clarity("set", `experiment_${assignment.id}`, assignment.variant);
        window.clarity("set", "experiment_variant", assignment.variant);
    }
}

export function markExperimentExposed(context: ExperimentContext[]): ExperimentContext[] {
    if (typeof window === "undefined") return [];
    setClarityExperimentContext(context);
    return context.filter((assignment) => {
        const key = `_ca_exp_seen_${assignment.id}_${assignment.variant}`;
        try {
            if (localStorage.getItem(key)) return false;
            localStorage.setItem(key, JSON.stringify({
                exposedAt: new Date().toISOString(),
                visitorId: getVisitorId(),
                version: 1,
                pagePath: window.location.pathname,
                device: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? "mobile" : "desktop",
            }));
            return true;
        } catch {
            // If storage is unavailable, prefer a duplicate exposure over losing
            // the visitor from the experiment denominator entirely.
            return true;
        }
    });
}
