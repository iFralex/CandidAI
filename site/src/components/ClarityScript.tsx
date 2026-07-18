"use client";

/**
 * Microsoft Clarity session recording + heatmaps.
 *
 * Loads only if NEXT_PUBLIC_CLARITY_PROJECT_ID is set in env — no project
 * ID means no script is injected (safe for dev / preview deployments).
 *
 * Cookie consent: Clarity uses cookies + localStorage. Currently loaded
 * unconditionally. If/when we wire iubenda consent into the app, gate this
 * mount on consent state to be strictly GDPR-compliant.
 *
 * Setup: clarity.microsoft.com → create project → copy the project ID
 * (a short alphanumeric like "qabcdefg12") into .env.local as
 *     NEXT_PUBLIC_CLARITY_PROJECT_ID=qabcdefg12
 */
import { useEffect } from "react";

declare global {
    interface Window {
        clarity?: (...args: unknown[]) => void;
    }
}

export function ClarityScript() {
    useEffect(() => {
        const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
        if (!projectId) return;
        if (typeof window === "undefined") return;
        if (window.clarity) return; // already loaded

        // Official Clarity loader (rewritten from the docs snippet, no var leaks)
        const w = window as unknown as Record<string, unknown>;
        w.clarity = w.clarity ?? function (...args: unknown[]) {
            ((w.clarity as { q?: unknown[] }).q = ((w.clarity as { q?: unknown[] }).q ?? [])).push(args);
        };
        const clarity = w.clarity as (...args: unknown[]) => void;
        clarity("set", "experiment_qa", document.cookie.includes("_ca_exp_qa=1") ? "true" : "false");
        // The experiment provider may mount before Clarity. Replay its context
        // into the official Clarity queue so recordings and heatmaps can be
        // filtered by experiment and variant from their very first page.
        for (const assignment of window.__caExperimentContext ?? []) {
            clarity("set", "experiment", assignment.id);
            clarity("set", `experiment_${assignment.id}`, assignment.variant);
            clarity("set", "experiment_variant", assignment.variant);
        }
        const t = document.createElement("script");
        t.async = true;
        t.src = `https://www.clarity.ms/tag/${projectId}`;
        const y = document.getElementsByTagName("script")[0];
        y?.parentNode?.insertBefore(t, y);
    }, []);

    return null;
}
