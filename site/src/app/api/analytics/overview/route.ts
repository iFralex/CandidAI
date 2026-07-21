import { NextRequest, NextResponse } from "next/server";
import { runReport, runRealtimeReport, dateRange, GaDateRange } from "@/lib/ga-data-client";
import { adminDb } from "@/lib/firebase-admin";
import { FieldPath, QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import { loadClaritySnapshot } from "@/lib/clarity-data";
import { adminAuth } from "@/lib/firebase-admin";
import { publicExperimentDefinitions } from "@/lib/experiments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth is enforced by middleware.ts (HTTP Basic Auth, SESSION_API_KEY)

type Range = "7d" | "30d" | "90d";

function rangeFor(r: Range): GaDateRange {
    switch (r) {
        case "7d": return dateRange.last7Days();
        case "90d": return dateRange.last90Days();
        case "30d":
        default: return dateRange.last30Days();
    }
}

function cutoffDate(r: Range): Date {
    const days = r === "7d" ? 7 : r === "90d" ? 90 : 30;
    return new Date(Date.now() - days * 86400_000);
}

const FUNNEL_ORDER = [
    "page_view",
    "signup_attempt",
    "signup_success",
    "onboarding_complete",
    "checkout_open",
    "checkout_submit",
    "checkout_success",
    "email_send",
] as const;

export async function GET(req: NextRequest) {
    const range: Range = (req.nextUrl.searchParams.get("range") as Range) || "30d";
    const dr = rangeFor(range);
    const experimentFilters = {
        device: req.nextUrl.searchParams.get("device") ?? "all",
        source: req.nextUrl.searchParams.get("source") ?? "all",
        browser: req.nextUrl.searchParams.get("browser") ?? "all",
        campaign: req.nextUrl.searchParams.get("campaign") ?? "all",
        locale: req.nextUrl.searchParams.get("locale") ?? "all",
        country: req.nextUrl.searchParams.get("country") ?? "all",
        auth: req.nextUrl.searchParams.get("auth") ?? "all",
        plan: req.nextUrl.searchParams.get("plan") ?? "all",
    };
    if (req.nextUrl.searchParams.get("format") === "csv") {
        const report = await fetchExperimentReport(cutoffDate(range), experimentFilters);
        const header = ["experiment", "status", "variant", "exposures", "primary_goal", "conversions", "conversion_rate", "uplift", "ci_low", "ci_high", "p_value", "probability_best", "revenue_cents", "revenue_per_exposure_cents", "srm_p_value", "alerts"];
        const rows: unknown[][] = [header];
        for (const experiment of report) for (const variant of experiment.variants) rows.push([
            experiment.id, experiment.status, variant.name, variant.exposures, experiment.primaryGoal,
            variant.primaryConversions, variant.conversionRate, variant.comparison.uplift ?? "",
            variant.comparison.ciLow ?? "", variant.comparison.ciHigh ?? "", variant.comparison.pValue ?? "",
            variant.comparison.probabilityBest ?? "", variant.revenueCents, variant.revenuePerExposureCents,
            experiment.srmPValue ?? "", experiment.alerts.join("; "),
        ]);
        const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        return new Response(rows.map((row) => row.map(quote).join(",")).join("\n"), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="candidai-experiments-${new Date().toISOString().slice(0, 10)}.csv"`,
                "Cache-Control": "no-store",
            },
        });
    }

    try {
        const [kpis, trend, topEvents, topPages, sources, customFunnel, realtime, revenue, clarity, cohorts, timeToX, feedback, experiments, onboardingFunnel, communications] = await Promise.all([
            runReport({
                dateRanges: [dr],
                metrics: [
                    "activeUsers",
                    "newUsers",
                    "sessions",
                    "screenPageViews",
                    "eventCount",
                    "averageSessionDuration",
                    "bounceRate",
                ],
            }),
            runReport({
                dateRanges: [dr],
                dimensions: ["date"],
                metrics: ["activeUsers", "sessions", "newUsers"],
                orderBys: [{ dimension: { dimensionName: "date" } }],
                limit: 365,
            }),
            runReport({
                dateRanges: [dr],
                dimensions: ["eventName"],
                metrics: ["eventCount", "totalUsers"],
                orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
                limit: 25,
            }),
            runReport({
                dateRanges: [dr],
                dimensions: ["pagePath"],
                metrics: ["screenPageViews", "activeUsers", "averageSessionDuration"],
                orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
                limit: 15,
            }),
            runReport({
                dateRanges: [dr],
                dimensions: ["sessionSource", "sessionMedium"],
                metrics: ["sessions", "totalUsers"],
                orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
                limit: 15,
            }),
            runReport({
                dateRanges: [dr],
                dimensions: ["eventName"],
                metrics: ["eventCount", "totalUsers"],
                dimensionFilter: {
                    filter: {
                        fieldName: "eventName",
                        inListFilter: { values: [...FUNNEL_ORDER] },
                    },
                },
            }),
            // ── Realtime (last 30 min, GA4-fixed window) ──────────────
            runRealtimeReport({
                dimensions: ["unifiedScreenName"],
                metrics: ["activeUsers", "screenPageViews"],
                limit: 10,
            }).catch(() => ({ rows: [], totals: [], rowCount: 0 })),
            // ── Revenue from Firestore payment_succeeded events ───────
            fetchRevenue(cutoffDate(range)).catch(() => emptyRevenue()),
            // ── Clarity frustration snapshot (cached, refreshed by daily cron) ─
            loadClaritySnapshot().catch(() => null),
            // ── Activation + cohort retention computed from users docs ────
            computeActivationCohorts().catch(() => emptyCohorts()),
            // ── Time-to-X conversion durations (signup → activation, etc.) ─
            computeTimeToX().catch(() => emptyTimeToX()),
            // ── Voice of customer (in-app micro-survey responses) ─────────
            fetchFeedback().catch(() => emptyFeedback()),
            fetchExperimentReport(cutoffDate(range), experimentFilters).catch(() => []),
            fetchOnboardingFunnel(cutoffDate(range)).catch(() => []),
            fetchCommunicationAnalytics(cutoffDate(range)).catch(() => emptyCommunicationAnalytics()),
        ]);

        const k = kpis.totals;
        return NextResponse.json({
            range,
            kpis: {
                activeUsers: Number(k[0] ?? 0),
                newUsers: Number(k[1] ?? 0),
                sessions: Number(k[2] ?? 0),
                pageViews: Number(k[3] ?? 0),
                eventCount: Number(k[4] ?? 0),
                avgSessionDurationSec: Number(k[5] ?? 0),
                bounceRate: Number(k[6] ?? 0),
            },
            trend: trend.rows.map((r) => ({
                date: r.dimensions[0],
                activeUsers: Number(r.metrics[0]),
                sessions: Number(r.metrics[1]),
                newUsers: Number(r.metrics[2]),
            })),
            topEvents: topEvents.rows.map((r) => ({
                name: r.dimensions[0],
                count: Number(r.metrics[0]),
                users: Number(r.metrics[1]),
            })),
            topPages: topPages.rows.map((r) => ({
                path: r.dimensions[0],
                views: Number(r.metrics[0]),
                users: Number(r.metrics[1]),
                avgDurationSec: Number(r.metrics[2]),
            })),
            sources: sources.rows.map((r) => ({
                source: r.dimensions[0],
                medium: r.dimensions[1],
                sessions: Number(r.metrics[0]),
                users: Number(r.metrics[1]),
            })),
            funnel: buildFunnel(customFunnel.rows),
            realtime: {
                activeUsers: Number(realtime.totals[0] ?? 0),
                pageViews: Number(realtime.totals[1] ?? 0),
                topScreens: realtime.rows.map((r) => ({
                    name: r.dimensions[0] || "(unknown)",
                    activeUsers: Number(r.metrics[0]),
                    pageViews: Number(r.metrics[1]),
                })),
            },
            revenue,
            clarity,
            cohorts,
            timeToX,
            feedback,
            experiments,
            experimentFilters,
            onboardingFunnel,
            communications,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("GA Data API error:", message);
        return NextResponse.json(
            { error: "ga_query_failed", message },
            { status: 500 }
        );
    }
}

type CommunicationAnalytics = {
    totals: Record<string, number>;
    categories: { name: string; sent: number; delivered: number; opened: number; clicked: number }[];
    types: { name: string; sent: number; attributed: number; conversion: number; avgResumeMs: number | null }[];
    cooldownUsers: number;
    recentIssues: { userId: string; type: string; status: string; attempts: number; error: string | null; updatedAt: string | null }[];
    health: { status: string; checkedAt: string | null; alerts: string[]; staleSending: number };
};

function emptyCommunicationAnalytics(): CommunicationAnalytics {
    return { totals: {}, categories: [], types: [], cooldownUsers: 0, recentIssues: [], health: { status: "unknown", checkedAt: null, alerts: [], staleSending: 0 } };
}

async function fetchCommunicationAnalytics(cutoff: Date): Promise<CommunicationAnalytics> {
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const [dailySnap, healthSnap, cooldownSnap, recentCommunicationSnap] = await Promise.all([
        adminDb.collection("analytics_daily").where(FieldPath.documentId(), ">=", cutoffDay).get(),
        adminDb.collection("_system").doc("operational_health").get(),
        adminDb.collection("users").where("lastLifecycleEmailSentAt", ">=", Timestamp.fromMillis(Date.now() - 48 * 60 * 60_000)).count().get(),
        adminDb.collectionGroup("communications").orderBy("updatedAt", "desc").limit(100).get(),
    ]);
    const totals: Record<string, number> = {};
    for (const doc of dailySnap.docs) for (const [key, value] of Object.entries(doc.data())) {
        if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value;
    }
    const categoryNames = new Set<string>();
    const typeNames = new Set<string>();
    for (const key of Object.keys(totals)) {
        const categoryMatch = key.match(/^communications_sent_category_(.+)$/);
        if (categoryMatch) categoryNames.add(categoryMatch[1]);
        const typeMatch = key.match(/^communications_sent_type_(.+)$/);
        if (typeMatch) typeNames.add(typeMatch[1]);
    }
    const categories = [...categoryNames].map(name => ({
        name,
        sent: totals[`communications_sent_category_${name}`] ?? 0,
        delivered: totals[`communications_delivered_category_${name}`] ?? 0,
        opened: totals[`communications_opened_category_${name}`] ?? 0,
        clicked: totals[`communications_clicked_category_${name}`] ?? 0,
    })).sort((a, b) => b.sent - a.sent);
    const types = [...typeNames].map(name => {
        const sent = totals[`communications_sent_type_${name}`] ?? 0;
        const attributed = totals[`attributed_communication_${name}`] ?? 0;
        return { name, sent, attributed, conversion: sent ? attributed / sent : 0, avgResumeMs: attributed ? (totals[`attributed_age_ms_${name}`] ?? 0) / attributed : null };
    }).sort((a, b) => b.sent - a.sent);
    const health = healthSnap.data() ?? {};
    return {
        totals,
        categories,
        types,
        cooldownUsers: cooldownSnap.data().count,
        recentIssues: recentCommunicationSnap.docs
            .filter(doc => ["failed", "sending"].includes(String(doc.data().status)))
            .slice(0, 20)
            .map(doc => ({
                userId: doc.ref.parent.parent?.id ?? "unknown",
                type: String(doc.data().type ?? "unknown"),
                status: String(doc.data().status ?? "unknown"),
                attempts: Number(doc.data().attempts ?? 0),
                error: doc.data().lastError ? String(doc.data().lastError) : null,
                updatedAt: doc.data().updatedAt?.toDate?.().toISOString?.() ?? null,
            })),
        health: {
            status: String(health.status ?? "unknown"),
            checkedAt: health.checkedAt?.toDate?.().toISOString?.() ?? null,
            alerts: Array.isArray(health.alerts) ? health.alerts.map(String) : [],
            staleSending: Number(health.staleSending ?? 0),
        },
    };
}

const ONBOARDING_FUNNEL_STAGES = [
    "profile_source", "profile_review", "target_company", "recruiter_search",
    "recruiter_found", "email_generation", "preview_ready", "checkout",
    "post_purchase", "post_purchase_profile", "post_purchase_companies",
    "post_purchase_filters", "post_purchase_instructions", "post_purchase_review", "completed",
] as const;

async function fetchOnboardingFunnel(cutoff: Date) {
    const [snap, dailySnap] = await Promise.all([
        adminDb.collection("analytics_events")
            .where("timestamp", ">=", Timestamp.fromDate(cutoff))
            .orderBy("timestamp", "asc")
            .limit(20_000)
            .get(),
        adminDb.collection("analytics_daily")
            .where(FieldPath.documentId(), ">=", cutoff.toISOString().slice(0, 10))
            .get(),
    ]);
    const aggregateEntries = new Map<string, number>();
    for (const doc of dailySnap.docs) for (const stage of ONBOARDING_FUNNEL_STAGES) {
        aggregateEntries.set(stage, (aggregateEntries.get(stage) ?? 0) + Number(doc.data()[`onboarding_stage_${stage}`] ?? 0));
    }
    const entered = new Map<string, Set<string>>();
    const errors = new Map<string, number>();
    const userStages = new Map<string, { stage: string; at: number }[]>();
    ONBOARDING_FUNNEL_STAGES.forEach(stage => entered.set(stage, new Set()));

    for (const doc of snap.docs) {
        const data = doc.data();
        const uid = typeof data.user_id === "string" ? data.user_id : null;
        if (!uid) continue;
        const at = data.timestamp?.toMillis?.() ?? Date.parse(String(data.params?.occurred_at ?? ""));
        if (data.event === "onboarding_started") {
            entered.get("profile_source")!.add(uid);
            if (Number.isFinite(at)) userStages.set(uid, [...(userStages.get(uid) ?? []), { stage: "profile_source", at }]);
        }
        if (data.event === "onboarding_stage_entered") {
            const stage = String(data.params?.to_stage || "");
            if (!entered.has(stage)) continue;
            entered.get(stage)!.add(uid);
            if (Number.isFinite(at)) userStages.set(uid, [...(userStages.get(uid) ?? []), { stage, at }]);
        }
        if (data.event === "onboarding_job_failed") {
            const stage = String(data.params?.stage || "unknown");
            errors.set(stage, (errors.get(stage) ?? 0) + 1);
        }
    }

    return ONBOARDING_FUNNEL_STAGES.map((stage, index) => {
        const users = entered.get(stage)!;
        const nextStage = ONBOARDING_FUNNEL_STAGES[index + 1];
        const exactCompleted = nextStage
            ? [...users].filter(uid => entered.get(nextStage)?.has(uid)).length
            : users.size;
        const useAggregates = snap.size >= 20_000 && (aggregateEntries.get(stage) ?? 0) > 0;
        const enteredCount = useAggregates ? aggregateEntries.get(stage)! : users.size;
        const completed = useAggregates && nextStage
            ? Math.min(enteredCount, aggregateEntries.get(nextStage) ?? 0)
            : exactCompleted;
        const durations: number[] = [];
        if (nextStage) for (const uid of users) {
            const rows = userStages.get(uid) ?? [];
            const current = rows.find(row => row.stage === stage);
            const next = rows.find(row => row.stage === nextStage && current && row.at >= current.at);
            if (current && next) durations.push(next.at - current.at);
        }
        durations.sort((a, b) => a - b);
        const percentile = (p: number) => durations.length ? durations[Math.min(durations.length - 1, Math.floor((durations.length - 1) * p))] : null;
        return {
            stage,
            entered: enteredCount,
            completed,
            conversion: enteredCount ? completed / enteredCount : 0,
            medianMs: percentile(0.5),
            p95Ms: percentile(0.95),
            errors: errors.get(stage) ?? 0,
        };
    });
}

// ─── Experiments ───────────────────────────────────────────────────────────

type ExperimentVariantAccumulator = {
    exposures: Map<string, { at: number; segments: Record<string, string> }>;
    events: Map<string, Map<string, number[]>>;
    revenue: Map<string, { at: number; cents: number }[]>;
};

function eventAssignments(data: Record<string, any>): { id: string; variant: string }[] {
    const params = data.params ?? {};
    if (typeof params.experiment_id === "string" && typeof params.experiment_variant === "string") {
        const ids = params.experiment_id.split(",");
        const variants = params.experiment_variant.split(",");
        return ids.flatMap((id: string, index: number) => variants[index] ? [{ id, variant: variants[index] }] : []);
    }
    if (Array.isArray(data.experiments)) {
        return data.experiments.flatMap((row: any) =>
            typeof row?.id === "string" && typeof row?.variant === "string"
                ? [{ id: row.id, variant: row.variant }]
                : []
        );
    }
    if (data.experiments && typeof data.experiments === "object") {
        return Object.entries(data.experiments).flatMap(([id, row]: [string, any]) =>
            typeof row?.variant === "string" ? [{ id, variant: row.variant }] : []
        );
    }
    return [];
}

function normalCdf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * z);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return 0.5 * (1 + sign * erf);
}

function comparison(controlConversions: number, controlN: number, conversions: number, n: number) {
    if (!controlN || !n) return { uplift: null, ciLow: null, ciHigh: null, pValue: null, probabilityBest: null };
    const pc = controlConversions / controlN;
    const pv = conversions / n;
    const diff = pv - pc;
    const se = Math.sqrt((pc * (1 - pc)) / controlN + (pv * (1 - pv)) / n);
    const z = se > 0 ? diff / se : 0;
    return {
        uplift: pc > 0 ? pv / pc - 1 : null,
        ciLow: diff - 1.96 * se,
        ciHigh: diff + 1.96 * se,
        pValue: 2 * (1 - normalCdf(Math.abs(z))),
        probabilityBest: normalCdf(z),
    };
}

function deviceFromUserAgent(userAgent: unknown): string {
    const ua = String(userAgent ?? "").toLowerCase();
    return /mobile|android|iphone|ipad/.test(ua) ? "mobile" : "desktop";
}

function browserFromUserAgent(userAgent: unknown): string {
    const ua = String(userAgent ?? "").toLowerCase();
    if (ua.includes("edg/")) return "edge";
    if (ua.includes("firefox/")) return "firefox";
    if (ua.includes("chrome/")) return "chrome";
    if (ua.includes("safari/")) return "safari";
    return "other";
}

async function loadExperimentEvents(cutoff: Date) {
    const rows: QueryDocumentSnapshot[] = [];
    let cursor: QueryDocumentSnapshot | null = null;
    const pageSize = 5000;
    const hardLimit = 100000;
    while (rows.length < hardLimit) {
        let query = adminDb.collection("analytics_events")
            .where("timestamp", ">=", Timestamp.fromDate(cutoff))
            .orderBy("timestamp", "asc")
            .limit(pageSize);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        rows.push(...page.docs);
        if (page.size < pageSize) return { rows, truncated: false };
        cursor = page.docs[page.docs.length - 1];
    }
    return { rows, truncated: true };
}

async function fetchExperimentReport(cutoff: Date, filters: Record<string, string>) {
    const definitions = publicExperimentDefinitions();
    const loaded = await loadExperimentEvents(cutoff);

    const byExperiment = new Map<string, Map<string, ExperimentVariantAccumulator>>();
    for (const definition of definitions) {
        byExperiment.set(definition.id, new Map(definition.variants.map((variant) => [variant, {
            exposures: new Map(),
            events: new Map(),
            revenue: new Map(),
        }])));
    }

    for (const doc of loaded.rows) {
        const data = doc.data() as Record<string, any>;
        if (data.experiment_qa === true || data.params?.experiment_qa === "true") continue;
        const subject = String(data.visitor_id ?? data.user_id ?? data.session_id ?? doc.id);
        const at = (data.timestamp as Timestamp | undefined)?.toMillis?.();
        if (!at) continue;
        const device = deviceFromUserAgent(data.user_agent);
        const browser = browserFromUserAgent(data.user_agent);
        const source = String(data.attribution?.utm_source ?? "direct");
        const campaign = String(data.attribution?.utm_campaign ?? "none");
        const locale = String(data.locale ?? "unknown");
        const country = String(data.country ?? "unknown");
        const auth = data.authenticated ? "authenticated" : "anonymous";
        const plan = String(data.user_properties?.plan ?? "unknown");
        const segments = { device, source, browser, campaign, locale, country, auth, plan };
        for (const { id, variant } of eventAssignments(data)) {
            const accumulator = byExperiment.get(id)?.get(variant);
            if (!accumulator) continue;
            const matchesFilters = Object.entries(filters).every(([key, value]) =>
                value === "all" || segments[key] === value
            );
            if (data.event === "experiment_exposure" && matchesFilters && !accumulator.exposures.has(subject)) {
                accumulator.exposures.set(subject, { at, segments });
            }
            const subjectEvents = accumulator.events.get(subject) ?? new Map<string, number[]>();
            const times = subjectEvents.get(data.event) ?? [];
            times.push(at);
            subjectEvents.set(data.event, times);
            if (data.event === "web_vital" && data.params?.rating === "poor") {
                const poorVitals = subjectEvents.get("web_vital_poor") ?? [];
                poorVitals.push(at);
                subjectEvents.set("web_vital_poor", poorVitals);
            }
            accumulator.events.set(subject, subjectEvents);
            if (data.event === "payment_succeeded") {
                const payments = accumulator.revenue.get(subject) ?? [];
                payments.push({ at, cents: Number(data.params?.amount_cents ?? 0) });
                accumulator.revenue.set(subject, payments);
            }
        }
    }

    return definitions.map((definition) => {
        const evaluated = definition.variants.map((variant) => {
            const row = byExperiment.get(definition.id)!.get(variant)!;
            const exposures = row.exposures.size;
            const windowMs = definition.conversionWindowDays * 86400_000;
            const converted = (goal: string) => Array.from(row.exposures.entries()).filter(([subject, exposure]) =>
                (row.events.get(subject)?.get(goal) ?? []).some((at) => at >= exposure.at && at <= exposure.at + windowMs)
            ).length;
            const primaryConversions = converted(definition.primaryGoal);
            const revenueCents = Array.from(row.exposures.entries()).reduce((sum, [subject, exposure]) =>
                sum + (row.revenue.get(subject) ?? [])
                    .filter((payment) => payment.at >= exposure.at && payment.at <= exposure.at + windowMs)
                    .reduce((paymentSum, payment) => paymentSum + payment.cents, 0), 0
            );
            return {
                name: variant,
                exposures,
                primaryConversions,
                conversionRate: exposures > 0 ? primaryConversions / exposures : 0,
                revenueCents,
                revenuePerExposureCents: exposures > 0 ? revenueCents / exposures : 0,
                goals: [definition.primaryGoal, ...definition.secondaryGoals].map((goal) => ({
                    name: goal,
                    conversions: converted(goal),
                })),
                guardrails: definition.guardrailGoals.map((goal) => ({ name: goal, occurrences: converted(goal) })),
            };
        });
        const control = evaluated.find((row) => row.name === "control") ?? evaluated[0];
        const variants = evaluated.map((row) => ({
            ...row,
            comparison: row.name === control.name
                ? { uplift: 0, ciLow: 0, ciHigh: 0, pValue: 1, probabilityBest: 0.5 }
                : comparison(control.primaryConversions, control.exposures, row.primaryConversions, row.exposures),
        }));
        const totalExposures = variants.reduce((sum, row) => sum + row.exposures, 0);
        const expected = definition.variantWeights;
        const chiSquare = totalExposures > 0 ? variants.reduce((sum, row) => {
            const expectedCount = totalExposures * (Number(expected[row.name] ?? 0) / Object.values(expected).reduce((a, b) => a + Number(b), 0));
            return expectedCount > 0 ? sum + ((row.exposures - expectedCount) ** 2) / expectedCount : sum;
        }, 0) : 0;
        const srmPValue = variants.length === 2 ? 2 * (1 - normalCdf(Math.sqrt(chiSquare))) : null;
        const runtimeDays = definition.startedAt ? (Date.now() - new Date(definition.startedAt).getTime()) / 86400_000 : 0;
        const alerts = [
            ...(srmPValue !== null && srmPValue < 0.01 ? ["Sample ratio mismatch detected"] : []),
            ...(loaded.truncated ? ["Event scan reached the 100,000 row safety limit"] : []),
            ...(definition.status === "running" && totalExposures === 0 ? ["Running experiment has no exposures"] : []),
            ...(variants.some((row) => row.exposures < definition.minimumSamplePerVariant) ? ["Minimum sample not reached"] : []),
            ...(definition.status === "running" && runtimeDays < definition.minimumRuntimeDays ? ["Minimum runtime not reached"] : []),
        ];
        return { ...definition, variants, srmPValue, runtimeDays, alerts, scannedEvents: loaded.rows.length };
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map the GA funnel rows into the canonical FUNNEL_ORDER + compute
 * step-to-step retention (drop %).
 */
function buildFunnel(rows: { dimensions: string[]; metrics: string[] }[]) {
    const byName = new Map(rows.map((r) => [r.dimensions[0], r]));
    let prevUsers: number | null = null;
    return FUNNEL_ORDER.map((name) => {
        const r = byName.get(name);
        const users = r ? Number(r.metrics[1]) : 0;
        const count = r ? Number(r.metrics[0]) : 0;
        const drop = prevUsers && prevUsers > 0 ? 1 - users / prevUsers : null;
        const retentionFromPrev = prevUsers && prevUsers > 0 ? users / prevUsers : null;
        prevUsers = users;
        return { name, users, count, dropFromPrev: drop, retentionFromPrev };
    });
}

// ─── Activation + cohort retention ─────────────────────────────────────────

type WeeklyCohort = {
    weekStart: string;          // YYYY-MM-DD (Monday)
    signups: number;
    activated: number;          // # who hit activated_at
    activatedWithin24h: number; // # whose activated_at - signup <= 24h
    returned1d: number;
    returned7d: number;
    returned30d: number;
};

function emptyCohorts() {
    return {
        totalSignups: 0,
        activated: 0,
        activatedWithin24h: 0,
        activationRate: 0,
        activationRate24h: 0,
        weekly: [] as WeeklyCohort[],
    };
}

const DAY_MS = 86400_000;

function mondayOfWeek(date: Date): string {
    const d = new Date(date.getTime());
    d.setUTCHours(0, 0, 0, 0);
    // ISO week: Monday=1, Sunday=7. JS getUTCDay: Sun=0..Sat=6 → shift to Mon=0
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
}

async function computeActivationCohorts() {
    // Pull users from Auth (canonical createdAt) + Firestore docs in parallel.
    // Firestore gives us activated_at; Auth metadata gives us signup + lastSignIn.
    const [authPages, usersSnap] = await Promise.all([
        listAllAuthUsers(),
        adminDb.collection("users").get(),
    ]);
    const firestoreByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data() ?? {}]));

    const now = Date.now();
    const weekly = new Map<string, WeeklyCohort>();
    const out = emptyCohorts();

    for (const u of authPages) {
        const signupMs = u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : NaN;
        if (!Number.isFinite(signupMs)) continue;
        const lastLoginMs = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : NaN;

        const fs = firestoreByUid.get(u.uid) ?? {};
        const activatedAtMs = fs.activated_at?.toMillis?.() ?? null;

        const weekStart = mondayOfWeek(new Date(signupMs));
        const row = weekly.get(weekStart) ?? {
            weekStart, signups: 0, activated: 0, activatedWithin24h: 0,
            returned1d: 0, returned7d: 0, returned30d: 0,
        };
        row.signups++;
        out.totalSignups++;

        if (activatedAtMs) {
            row.activated++;
            out.activated++;
            if (activatedAtMs - signupMs <= DAY_MS) {
                row.activatedWithin24h++;
                out.activatedWithin24h++;
            }
        }

        // Returned at N days = lastLogin happened at least N days after signup
        // AND a full N days have actually elapsed since signup (otherwise the
        // bucket is incomplete and would understate retention).
        if (Number.isFinite(lastLoginMs)) {
            const gap = lastLoginMs - signupMs;
            if (now - signupMs >= 1 * DAY_MS && gap >= 1 * DAY_MS) row.returned1d++;
            if (now - signupMs >= 7 * DAY_MS && gap >= 7 * DAY_MS) row.returned7d++;
            if (now - signupMs >= 30 * DAY_MS && gap >= 30 * DAY_MS) row.returned30d++;
        }
        weekly.set(weekStart, row);
    }

    out.activationRate = out.totalSignups > 0 ? out.activated / out.totalSignups : 0;
    out.activationRate24h = out.totalSignups > 0 ? out.activatedWithin24h / out.totalSignups : 0;
    out.weekly = Array.from(weekly.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    return out;
}

// ─── Time-to-X conversion durations ─────────────────────────────────────────

type TimeToBucket = { sampleSize: number; medianMs: number | null; p25Ms: number | null; p75Ms: number | null };
type TimeToXReport = {
    activation: TimeToBucket;
    firstEmailSend: TimeToBucket;
    firstPayment: TimeToBucket;
};
function emptyBucket(): TimeToBucket { return { sampleSize: 0, medianMs: null, p25Ms: null, p75Ms: null }; }
function emptyTimeToX(): TimeToXReport {
    return { activation: emptyBucket(), firstEmailSend: emptyBucket(), firstPayment: emptyBucket() };
}

function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function summarize(samples: number[]): TimeToBucket {
    if (samples.length === 0) return emptyBucket();
    const sorted = [...samples].sort((a, b) => a - b);
    return {
        sampleSize: sorted.length,
        medianMs: percentile(sorted, 0.5),
        p25Ms: percentile(sorted, 0.25),
        p75Ms: percentile(sorted, 0.75),
    };
}

async function computeTimeToX(): Promise<TimeToXReport> {
    // Build uid → signupMs and uid → activatedAtMs from Auth + Firestore.
    const [authUsers, usersSnap] = await Promise.all([
        listAllAuthUsers(),
        adminDb.collection("users").get(),
    ]);
    const signupByUid = new Map<string, number>();
    for (const u of authUsers) {
        const ms = u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : NaN;
        if (Number.isFinite(ms)) signupByUid.set(u.uid, ms);
    }
    const activationDurations: number[] = [];
    for (const doc of usersSnap.docs) {
        const signupMs = signupByUid.get(doc.id);
        const activatedMs = doc.data()?.activated_at?.toMillis?.();
        if (signupMs && activatedMs && activatedMs >= signupMs) {
            activationDurations.push(activatedMs - signupMs);
        }
    }

    // Scan analytics_events once: for each user_id, capture first occurrence
    // of email_send and payment_succeeded. We overfetch and filter in JS to
    // avoid a composite index requirement.
    const firstEmailByUid = new Map<string, number>();
    const firstPaymentByUid = new Map<string, number>();
    const eventsSnap = await adminDb
        .collection("analytics_events")
        .orderBy("timestamp", "asc")
        .limit(10000)
        .get();
    for (const d of eventsSnap.docs) {
        const data = d.data();
        const uid = data.user_id as string | null | undefined;
        if (!uid) continue;
        const ts = (data.timestamp as Timestamp | undefined)?.toMillis?.();
        if (!ts) continue;
        if (data.event === "email_send" && !firstEmailByUid.has(uid)) {
            firstEmailByUid.set(uid, ts);
        } else if (data.event === "payment_succeeded" && !firstPaymentByUid.has(uid)) {
            firstPaymentByUid.set(uid, ts);
        }
    }

    const emailDurations: number[] = [];
    for (const [uid, ts] of firstEmailByUid) {
        const signupMs = signupByUid.get(uid);
        if (signupMs && ts >= signupMs) emailDurations.push(ts - signupMs);
    }
    const paymentDurations: number[] = [];
    for (const [uid, ts] of firstPaymentByUid) {
        const signupMs = signupByUid.get(uid);
        if (signupMs && ts >= signupMs) paymentDurations.push(ts - signupMs);
    }

    return {
        activation: summarize(activationDurations),
        firstEmailSend: summarize(emailDurations),
        firstPayment: summarize(paymentDurations),
    };
}

// ─── Voice of customer (Firestore `feedback` collection) ──────────────────

type FeedbackReport = {
    totalResponses: number;
    averageScore: number | null;
    distribution: { score: 1 | 2 | 3 | 4 | 5; count: number }[];
    recent: { score: number; comment: string | null; source: string; timestamp: string }[];
};

function emptyFeedback(): FeedbackReport {
    return {
        totalResponses: 0,
        averageScore: null,
        distribution: [1, 2, 3, 4, 5].map((s) => ({ score: s as 1 | 2 | 3 | 4 | 5, count: 0 })),
        recent: [],
    };
}

async function fetchFeedback(): Promise<FeedbackReport> {
    const snap = await adminDb
        .collection("feedback")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();

    const out = emptyFeedback();
    let sum = 0;
    for (const d of snap.docs) {
        const data = d.data();
        const score = Number(data.score ?? 0);
        if (score < 1 || score > 5) continue;
        out.totalResponses++;
        sum += score;
        const bucket = out.distribution.find((b) => b.score === score);
        if (bucket) bucket.count++;
        if (out.recent.length < 10) {
            const ts = (data.timestamp as Timestamp | undefined)?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
            out.recent.push({
                score,
                comment: data.comment ?? null,
                source: String(data.source ?? "unknown"),
                timestamp: ts,
            });
        }
    }
    out.averageScore = out.totalResponses > 0 ? sum / out.totalResponses : null;
    return out;
}

async function listAllAuthUsers() {
    const all: { uid: string; metadata: { creationTime?: string; lastSignInTime?: string } }[] = [];
    let next: string | undefined;
    do {
        const page = await adminAuth.listUsers(1000, next);
        for (const u of page.users) {
            all.push({ uid: u.uid, metadata: { creationTime: u.metadata?.creationTime, lastSignInTime: u.metadata?.lastSignInTime } });
        }
        next = page.pageToken;
    } while (next);
    return all;
}

function emptyRevenue() {
    return {
        currency: "EUR",
        totalCents: 0,
        paymentCount: 0,
        uniquePayers: 0,
        firstPurchaseCount: 0,
        byPlan: [] as { plan: string; revenueCents: number; count: number }[],
        recent: [] as { timestamp: string; amountCents: number; plan: string; isFirst: boolean }[],
    };
}

async function fetchRevenue(cutoff: Date) {
    // Read the most recent N events ordered by timestamp; filter in JS to avoid
    // requiring a composite Firestore index on (event, timestamp).
    const snap = await adminDb
        .collection("analytics_events")
        .orderBy("timestamp", "desc")
        .limit(2000)
        .get();

    const out = emptyRevenue();
    const payers = new Set<string>();
    const byPlan = new Map<string, { revenueCents: number; count: number }>();
    const cutoffTs = Timestamp.fromDate(cutoff);
    for (const doc of snap.docs) {
        const d = doc.data();
        if (d.event !== "payment_succeeded") continue;
        const ts = d.timestamp as Timestamp | undefined;
        if (!ts || ts.toMillis() < cutoffTs.toMillis()) continue;

        const p = (d.params ?? {}) as Record<string, unknown>;
        const amountCents = Number(p.amount_cents ?? 0);
        const plan = String(p.item_id ?? "unknown");
        const currency = String(p.currency ?? "EUR").toUpperCase();
        const isFirst = Boolean(p.is_first_purchase);

        out.currency = currency;
        out.totalCents += amountCents;
        out.paymentCount++;
        if (isFirst) out.firstPurchaseCount++;
        if (d.user_id) payers.add(String(d.user_id));

        const cur = byPlan.get(plan) ?? { revenueCents: 0, count: 0 };
        cur.revenueCents += amountCents;
        cur.count++;
        byPlan.set(plan, cur);

        if (out.recent.length < 10) {
            out.recent.push({
                timestamp: ts.toDate().toISOString(),
                amountCents,
                plan,
                isFirst,
            });
        }
    }
    out.uniquePayers = payers.size;
    out.byPlan = Array.from(byPlan.entries())
        .map(([plan, v]) => ({ plan, ...v }))
        .sort((a, b) => b.revenueCents - a.revenueCents);
    return out;
}
