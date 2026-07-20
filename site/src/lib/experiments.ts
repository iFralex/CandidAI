/**
 * Central experiment registry and edge-safe assignment helpers.
 *
 * This module is the single source of truth for experiments. GA4, Firestore
 * and Clarity only receive the assignment produced here; they never assign a
 * variant independently.
 */

export const EXPERIMENT_COOKIE = "_ca_experiments";
export const EXPERIMENT_HEADER = "x-ca-experiments";
export const VISITOR_COOKIE = "_ca_vid";
export const EXPERIMENT_QA_COOKIE = "_ca_exp_qa";
export const EXPERIMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export type ExperimentStatus = "draft" | "running" | "paused" | "completed";
export type ExperimentProvider = "server";

export type ExperimentDefinition = {
    status: ExperimentStatus;
    paths: readonly string[];
    variants: Readonly<Record<string, number>>;
    allocationPercent: number;
    primaryGoal: string;
    secondaryGoals: readonly string[];
    guardrailGoals: readonly string[];
    conversionWindowDays: number;
    observationWindowDays: number;
    minimumSamplePerVariant: number;
    minimumRuntimeDays: number;
    owner: string;
    hypothesis: string;
    createdAt: string;
    startedAt?: string;
    endedAt?: string;
    winner?: string;
    decisionReason?: string;
};

export const EXPERIMENTS = {
    landing_redesign_v1: {
        // Activate only when control and redesign render meaningfully different
        // experiences. A draft can still be forced in non-production via
        // ?ca_exp_landing_redesign_v1=redesign.
        status: "draft",
        paths: ["/"],
        variants: { control: 34, redesign: 33, apple: 33 },
        allocationPercent: 100,
        primaryGoal: "signup_success",
        secondaryGoals: [
            "landing_cta_click",
            "onboarding_complete",
            "checkout_success",
            "payment_succeeded",
        ],
        guardrailGoals: ["app_error", "web_vital_poor", "onboarding_complete", "payment_succeeded"],
        conversionWindowDays: 7,
        observationWindowDays: 30,
        minimumSamplePerVariant: 350,
        minimumRuntimeDays: 14,
        owner: "growth",
        hypothesis: "A cinematic, scroll-driven introduction that leads with a personalized email as the hero artifact increases qualified signups without harming activation, video engagement, or revenue, compared to both the current control and the product-led redesign. This is an experience comparison (structure and pacing differ, not just visual style).",
        createdAt: "2026-07-18T00:00:00.000Z",
    },
} as const satisfies Record<string, ExperimentDefinition>;

export type ExperimentId = keyof typeof EXPERIMENTS;
export type ExperimentAssignments = Partial<Record<ExperimentId, string>>;

export type ExperimentContext = {
    id: ExperimentId;
    variant: string;
    source: ExperimentProvider;
};

export function isExperimentId(value: string): value is ExperimentId {
    return Object.prototype.hasOwnProperty.call(EXPERIMENTS, value);
}

export function isValidVariant(id: ExperimentId, variant: string): boolean {
    return Object.prototype.hasOwnProperty.call(EXPERIMENTS[id].variants, variant);
}

export function experimentAppliesToPath(id: ExperimentId, pathname: string): boolean {
    return EXPERIMENTS[id].paths.some((path) => path === pathname);
}

export function isExperimentMeasurable(id: ExperimentId, now = new Date()): boolean {
    const definition: ExperimentDefinition = EXPERIMENTS[id];
    if (definition.status === "running" || definition.status === "paused") return true;
    if (definition.status !== "completed" || !definition.endedAt) return false;
    const observationEnds = new Date(definition.endedAt).getTime() + definition.observationWindowDays * 86400_000;
    return now.getTime() <= observationEnds;
}

export function parseExperimentAssignments(raw?: string | null): ExperimentAssignments {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const assignments: ExperimentAssignments = {};
        for (const [id, variant] of Object.entries(parsed)) {
            if (isExperimentId(id) && typeof variant === "string" && isValidVariant(id, variant)) {
                assignments[id] = variant;
            }
        }
        return assignments;
    } catch {
        return {};
    }
}

export function serializeExperimentAssignments(assignments: ExperimentAssignments): string {
    // NextResponse.cookies performs the cookie-safe encoding. Returning plain
    // JSON here also keeps the internal request header directly readable and
    // avoids double-encoding the value exposed through document.cookie.
    return JSON.stringify(assignments);
}

export function assignmentsToContext(assignments: ExperimentAssignments): ExperimentContext[] {
    return Object.entries(assignments)
        .filter(([id, variant]) => isExperimentId(id) && typeof variant === "string" && isValidVariant(id, variant))
        .map(([id, variant]) => ({ id: id as ExperimentId, variant: variant as string, source: "server" }));
}

export function chooseVariant(id: ExperimentId, random = Math.random()): string {
    const entries = Object.entries(EXPERIMENTS[id].variants) as [string, number][];
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.max(0, Math.min(0.999999999, random)) * total;
    for (const [variant, weight] of entries) {
        cursor -= weight;
        if (cursor < 0) return variant;
    }
    return entries[entries.length - 1][0];
}

export function resolveExperiments(args: {
    pathname: string;
    cookieValue?: string | null;
    overrides?: URLSearchParams;
    allowOverrides?: boolean;
    random?: () => number;
}): { assignments: ExperimentAssignments; changed: boolean } {
    const assignments = parseExperimentAssignments(args.cookieValue);
    let changed = false;

    for (const id of Object.keys(EXPERIMENTS) as ExperimentId[]) {
        const definition: ExperimentDefinition = EXPERIMENTS[id];
        if (!experimentAppliesToPath(id, args.pathname)) continue;

        const override = args.allowOverrides
            ? args.overrides?.get(`ca_exp_${id}`) ?? null
            : null;
        if (override && isValidVariant(id, override)) {
            if (assignments[id] !== override) changed = true;
            assignments[id] = override;
            continue;
        }

        if (definition.status !== "running" || assignments[id]) continue;
        if ((args.random?.() ?? Math.random()) * 100 >= definition.allocationPercent) continue;
        assignments[id] = chooseVariant(id, args.random?.());
        changed = true;
    }

    return { assignments, changed };
}

export function publicExperimentDefinitions() {
    return Object.entries(EXPERIMENTS).map(([id, rawDefinition]) => {
        const definition: ExperimentDefinition = rawDefinition;
        return ({
        id,
        status: definition.status,
        variants: Object.keys(definition.variants),
        variantWeights: { ...definition.variants },
        primaryGoal: definition.primaryGoal,
        secondaryGoals: [...definition.secondaryGoals],
        guardrailGoals: [...definition.guardrailGoals],
        allocationPercent: definition.allocationPercent,
        conversionWindowDays: definition.conversionWindowDays,
        observationWindowDays: definition.observationWindowDays,
        minimumSamplePerVariant: definition.minimumSamplePerVariant,
        minimumRuntimeDays: definition.minimumRuntimeDays,
        owner: definition.owner,
        hypothesis: definition.hypothesis,
        createdAt: definition.createdAt,
        startedAt: definition.startedAt,
        endedAt: definition.endedAt,
        winner: definition.winner,
        decisionReason: definition.decisionReason,
        });
    });
}
