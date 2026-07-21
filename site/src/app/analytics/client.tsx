"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Range = "7d" | "30d" | "90d";

type Overview = {
    range: Range;
    kpis: {
        activeUsers: number;
        newUsers: number;
        sessions: number;
        pageViews: number;
        eventCount: number;
        avgSessionDurationSec: number;
        bounceRate: number;
    };
    trend: { date: string; activeUsers: number; sessions: number; newUsers: number }[];
    topEvents: { name: string; count: number; users: number }[];
    topPages: { path: string; views: number; users: number; avgDurationSec: number }[];
    sources: { source: string; medium: string; sessions: number; users: number }[];
    funnel: { name: string; users: number; count: number; dropFromPrev: number | null; retentionFromPrev: number | null }[];
    realtime: {
        activeUsers: number;
        pageViews: number;
        topScreens: { name: string; activeUsers: number; pageViews: number }[];
    };
    revenue: {
        currency: string;
        totalCents: number;
        paymentCount: number;
        uniquePayers: number;
        firstPurchaseCount: number;
        byPlan: { plan: string; revenueCents: number; count: number }[];
        recent: { timestamp: string; amountCents: number; plan: string; isFirst: boolean }[];
    };
    clarity: {
        fetchedAt: string;
        numOfDays: number;
        traffic: {
            totalSessions: number;
            sessionsWithRageClicks: number;
            sessionsWithDeadClicks: number;
            sessionsWithExcessiveScroll: number;
            sessionsWithQuickBacks: number;
            sessionsWithScriptErrors: number;
            sessionsWithErrorClicks: number;
            botSessions: number | null;
            averageEngagementTimeMs: number | null;
            averageScrollDepth: number | null;
        };
        topByMetric: Record<string, { url: string; count: number }[]>;
        rateLimitedOrEmpty: boolean;
    } | null;
    cohorts: {
        totalSignups: number;
        activated: number;
        activatedWithin24h: number;
        activationRate: number;
        activationRate24h: number;
        weekly: {
            weekStart: string;
            signups: number;
            activated: number;
            activatedWithin24h: number;
            returned1d: number;
            returned7d: number;
            returned30d: number;
        }[];
    };
    timeToX: {
        activation: TimeBucket;
        firstEmailSend: TimeBucket;
        firstPayment: TimeBucket;
    };
    feedback: {
        totalResponses: number;
        averageScore: number | null;
        distribution: { score: 1 | 2 | 3 | 4 | 5; count: number }[];
        recent: { score: number; comment: string | null; source: string; timestamp: string }[];
    };
    experiments: {
        id: string;
        status: "draft" | "running" | "paused" | "completed";
        primaryGoal: string;
        secondaryGoals: string[];
        guardrailGoals: string[];
        hypothesis: string;
        owner: string;
        minimumSamplePerVariant: number;
        minimumRuntimeDays: number;
        conversionWindowDays: number;
        runtimeDays: number;
        srmPValue: number | null;
        alerts: string[];
        scannedEvents: number;
        startedAt?: string;
        variants: {
            name: string;
            exposures: number;
            primaryConversions: number;
            conversionRate: number;
            revenueCents: number;
            revenuePerExposureCents: number;
            goals: { name: string; conversions: number }[];
            guardrails: { name: string; occurrences: number }[];
            comparison: {
                uplift: number | null;
                ciLow: number | null;
                ciHigh: number | null;
                pValue: number | null;
                probabilityBest: number | null;
            };
        }[];
    }[];
    experimentFilters: Record<string, string>;
    onboardingFunnel: { stage: string; entered: number; completed: number; conversion: number; medianMs: number | null; p95Ms: number | null; errors: number }[];
    communications: {
        totals: Record<string, number>;
        categories: { name: string; sent: number; delivered: number; opened: number; clicked: number }[];
        types: { name: string; sent: number; attributed: number; conversion: number; avgResumeMs: number | null }[];
        cooldownUsers: number;
        recentIssues: { userId: string; type: string; status: string; attempts: number; error: string | null; updatedAt: string | null }[];
        health: { status: string; checkedAt: string | null; alerts: string[]; staleSending: number };
    };
};

type TimeBucket = { sampleSize: number; medianMs: number | null; p25Ms: number | null; p75Ms: number | null };

const RANGES: { value: Range; label: string }[] = [
    { value: "7d", label: "Ultimi 7 giorni" },
    { value: "30d", label: "Ultimi 30 giorni" },
    { value: "90d", label: "Ultimi 90 giorni" },
];


export function AnalyticsDashboardClient() {
    const [range, setRange] = useState<Range>("30d");
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [experimentDevice, setExperimentDevice] = useState("all");
    const [experimentSource, setExperimentSource] = useState("all");
    const [experimentBrowser, setExperimentBrowser] = useState("all");
    const [experimentAuth, setExperimentAuth] = useState("all");
    const [experimentPlan, setExperimentPlan] = useState("all");

    useEffect(() => {
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams({
            range, device: experimentDevice, source: experimentSource,
            browser: experimentBrowser, auth: experimentAuth, plan: experimentPlan,
        });
        fetch(`/api/analytics/overview?${qs}`, { cache: "no-store" })
            .then(async (r) => {
                if (!r.ok) {
                    const body = await r.json().catch(() => ({}));
                    throw new Error(body?.message || `HTTP ${r.status}`);
                }
                return r.json() as Promise<Overview>;
            })
            .then(setData)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
    }, [range, experimentDevice, experimentSource, experimentBrowser, experimentAuth, experimentPlan]);

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Analytics</h1>
                        <p className="text-sm text-white/60 mt-1">
                            Dati live da Google Analytics 4
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="/analytics/user" className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30">
                            🔍 User search
                        </a>
                        <RangePicker value={range} onChange={setRange} />
                    </div>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                        <div className="font-medium">Errore caricamento dati</div>
                        <div className="mt-1 font-mono text-xs text-red-300/80">{error}</div>
                        <ul className="mt-3 list-disc pl-5 text-xs text-red-200/80 space-y-1">
                            <li>Verifica che <code>GA4_PROPERTY_ID</code> sia nel <code>.env.local</code></li>
                            <li>Verifica che il service account Firebase Admin sia Viewer della property</li>
                            <li>Verifica che la Google Analytics Data API sia abilitata sul progetto GCP</li>
                        </ul>
                    </div>
                )}

                {loading && !data ? (
                    <LoadingState />
                ) : data ? (
                    <>
                        <Realtime data={data.realtime} />
                        <KpiGrid kpis={data.kpis} />
                        <RevenuePanel revenue={data.revenue} />
                        <OnboardingFunnelPanel rows={data.onboardingFunnel} />
                        <CommunicationsPanel data={data.communications} />
                        <ExperimentsPanel
                            experiments={data.experiments}
                            device={experimentDevice}
                            source={experimentSource}
                            onDeviceChange={setExperimentDevice}
                            onSourceChange={setExperimentSource}
                            browser={experimentBrowser}
                            auth={experimentAuth}
                            plan={experimentPlan}
                            onBrowserChange={setExperimentBrowser}
                            onAuthChange={setExperimentAuth}
                            onPlanChange={setExperimentPlan}
                        />
                        <TrendChart trend={data.trend} />
                        <div className="grid lg:grid-cols-2 gap-6">
                            <Funnel steps={data.funnel} />
                            <TopEvents events={data.topEvents} />
                        </div>
                        <FrustrationPanel clarity={data.clarity} />
                        <CohortsPanel cohorts={data.cohorts} />
                        <TimeToXPanel data={data.timeToX} />
                        <FeedbackPanel feedback={data.feedback} />
                        <div className="grid lg:grid-cols-2 gap-6">
                            <TopPages pages={data.topPages} />
                            <Sources sources={data.sources} />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function ExperimentsPanel({
    experiments,
    device,
    source,
    onDeviceChange,
    onSourceChange,
    browser,
    auth,
    plan,
    onBrowserChange,
    onAuthChange,
    onPlanChange,
}: {
    experiments: Overview["experiments"];
    device: string;
    source: string;
    onDeviceChange: (value: string) => void;
    onSourceChange: (value: string) => void;
    browser: string;
    auth: string;
    plan: string;
    onBrowserChange: (value: string) => void;
    onAuthChange: (value: string) => void;
    onPlanChange: (value: string) => void;
}) {
    return (
        <Card title="A/B experiments · internal assignment, GA4 + Firestore + Clarity">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <select value={device} onChange={(e) => onDeviceChange(e.target.value)} className="rounded-md border border-white/10 bg-black px-3 py-2">
                        <option value="all">All devices</option>
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                    </select>
                    <input
                        value={source}
                        onChange={(e) => onSourceChange(e.target.value || "all")}
                        placeholder="Source: all, direct, google…"
                        className="w-52 rounded-md border border-white/10 bg-black px-3 py-2"
                    />
                    <select value={browser} onChange={(e) => onBrowserChange(e.target.value)} className="rounded-md border border-white/10 bg-black px-3 py-2">
                        <option value="all">All browsers</option><option value="chrome">Chrome</option><option value="safari">Safari</option><option value="firefox">Firefox</option><option value="edge">Edge</option>
                    </select>
                    <select value={auth} onChange={(e) => onAuthChange(e.target.value)} className="rounded-md border border-white/10 bg-black px-3 py-2">
                        <option value="all">All users</option><option value="anonymous">Anonymous</option><option value="authenticated">Authenticated</option>
                    </select>
                    <input value={plan} onChange={(e) => onPlanChange(e.target.value || "all")} placeholder="Plan: all, pro…" className="w-36 rounded-md border border-white/10 bg-black px-3 py-2" />
                    <a href={`/api/analytics/overview?format=csv&device=${encodeURIComponent(device)}&source=${encodeURIComponent(source)}&browser=${encodeURIComponent(browser)}&auth=${encodeURIComponent(auth)}&plan=${encodeURIComponent(plan)}`} className="rounded-md border border-white/10 px-3 py-2 text-white/70 hover:text-white">Export CSV</a>
                    <a href="https://clarity.microsoft.com/" target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-3 py-2 text-white/70 hover:text-white">Clarity recordings ↗</a>
                </div>
                {experiments.map((experiment) => (
                    <div key={experiment.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div>
                                <div className="font-mono text-sm text-white/90">{experiment.id}</div>
                                <div className="text-xs text-white/45 mt-1">Primary goal: {experiment.primaryGoal}</div>
                                <div className="text-xs text-white/35 mt-1">{experiment.hypothesis}</div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs ${
                                experiment.status === "running"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-white/10 text-white/60"
                            }`}>
                                {experiment.status}
                            </span>
                        </div>
                        {experiment.alerts.length > 0 && (
                            <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                {experiment.alerts.join(" · ")}
                            </div>
                        )}
                        <Table
                            head={["Variant", "Exposures", experiment.primaryGoal, "Conversion", "Uplift", "95% CI", "P(best)", "Revenue / exposure"]}
                            rows={experiment.variants.map((variant) => [
                                <span key="name" className="font-medium">{variant.name}</span>,
                                <span key="exposures" className="tabular-nums">{variant.exposures.toLocaleString()}</span>,
                                <span key="conversions" className="tabular-nums">{variant.primaryConversions.toLocaleString()}</span>,
                                <span key="rate" className="tabular-nums">{variant.exposures ? `${(variant.conversionRate * 100).toFixed(1)}%` : "—"}</span>,
                                <span key="uplift" className="tabular-nums">{variant.comparison.uplift == null ? "—" : `${variant.comparison.uplift >= 0 ? "+" : ""}${(variant.comparison.uplift * 100).toFixed(1)}%`}</span>,
                                <span key="ci" className="tabular-nums text-xs">{variant.comparison.ciLow == null ? "—" : `${(variant.comparison.ciLow * 100).toFixed(1)}–${(variant.comparison.ciHigh! * 100).toFixed(1)}pp`}</span>,
                                <span key="probability" className="tabular-nums">{variant.comparison.probabilityBest == null ? "—" : `${(variant.comparison.probabilityBest * 100).toFixed(1)}%`}</span>,
                                <span key="rpe" className="tabular-nums">{variant.exposures ? `€${(variant.revenuePerExposureCents / 100).toFixed(2)}` : "—"}</span>,
                            ])}
                        />
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
                            <span>Window: {experiment.conversionWindowDays}d</span>
                            <span>Runtime: {experiment.runtimeDays.toFixed(1)} / {experiment.minimumRuntimeDays}d</span>
                            <span>Minimum sample: {experiment.minimumSamplePerVariant}/variant</span>
                            <span>SRM p: {experiment.srmPValue == null ? "—" : experiment.srmPValue.toFixed(4)}</span>
                            <span>Events scanned: {experiment.scannedEvents.toLocaleString()}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {experiment.variants.map((variant) => (
                                <div key={variant.name} className="rounded-md bg-black/20 px-3 py-2 text-xs text-white/50">
                                    <span className="text-white/75">{variant.name} guardrails:</span>{" "}
                                    {variant.guardrails.map((guardrail) => `${guardrail.name} ${guardrail.occurrences}`).join(" · ")}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {experiments.length === 0 && <div className="text-sm text-white/50">No experiments configured.</div>}
            </div>
        </Card>
    );
}

// ─── Range picker ──────────────────────────────────────────────────────────

function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
    return (
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
            {RANGES.map((r) => (
                <button
                    key={r.value}
                    onClick={() => onChange(r.value)}
                    className={`px-3 py-1.5 text-xs rounded-md transition ${
                        value === r.value
                            ? "bg-white text-black"
                            : "text-white/70 hover:text-white"
                    }`}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );
}

// ─── KPI cards ─────────────────────────────────────────────────────────────

function KpiGrid({ kpis }: { kpis: Overview["kpis"] }) {
    const cards = [
        { label: "Utenti attivi", value: kpis.activeUsers.toLocaleString() },
        { label: "Nuovi utenti", value: kpis.newUsers.toLocaleString() },
        { label: "Sessioni", value: kpis.sessions.toLocaleString() },
        { label: "Page views", value: kpis.pageViews.toLocaleString() },
        { label: "Eventi totali", value: kpis.eventCount.toLocaleString() },
        { label: "Durata media sessione", value: formatDuration(kpis.avgSessionDurationSec) },
        { label: "Bounce rate", value: `${(kpis.bounceRate * 100).toFixed(1)}%` },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {cards.map((c) => (
                <div
                    key={c.label}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                    <div className="text-xs text-white/60">{c.label}</div>
                    <div className="text-xl font-semibold text-white mt-1 tabular-nums">
                        {c.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Trend chart (inline SVG area) ─────────────────────────────────────────

function TrendChart({ trend }: { trend: Overview["trend"] }) {
    const { path, areaPath, maxY, points } = useMemo(() => buildAreaChart(trend), [trend]);

    if (trend.length === 0) {
        return <Card title="Utenti attivi nel tempo">Nessun dato.</Card>;
    }

    const w = 800;
    const h = 220;
    return (
        <Card title="Utenti attivi nel tempo">
            <div className="relative">
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-56"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((t) => (
                        <line
                            key={t}
                            x1={0}
                            x2={w}
                            y1={h * t}
                            y2={h * t}
                            stroke="white"
                            strokeOpacity="0.06"
                        />
                    ))}
                    <path d={areaPath} fill="url(#trendGrad)" />
                    <path d={path} fill="none" stroke="#a78bfa" strokeWidth={2} />
                </svg>
                <div className="flex justify-between mt-2 text-[10px] text-white/40 font-mono">
                    <span>{formatGaDate(points[0]?.date)}</span>
                    <span>max: {maxY}</span>
                    <span>{formatGaDate(points[points.length - 1]?.date)}</span>
                </div>
            </div>
        </Card>
    );
}

// ─── Realtime (last 30 min) ────────────────────────────────────────────────

function Realtime({ data }: { data: Overview["realtime"] }) {
    return (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-white/90 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Realtime · ultimi 30 minuti
                </h2>
                <div className="text-xs text-white/50 tabular-nums">
                    {data.activeUsers} utenti · {data.pageViews} page views
                </div>
            </div>
            {data.topScreens.length > 0 ? (
                <ul className="space-y-1">
                    {data.topScreens.slice(0, 6).map((s) => (
                        <li key={s.name} className="flex justify-between text-xs">
                            <span className="font-mono text-white/80 truncate">{s.name}</span>
                            <span className="text-white/60 tabular-nums">{s.activeUsers}u · {s.pageViews}v</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-xs text-white/50">Nessuna attività negli ultimi 30 minuti.</div>
            )}
        </section>
    );
}

// ─── Revenue ───────────────────────────────────────────────────────────────

function RevenuePanel({ revenue }: { revenue: Overview["revenue"] }) {
    if (revenue.paymentCount === 0) {
        return (
            <Card title="Revenue">
                <div className="text-sm text-white/50">
                    Nessun pagamento nel periodo selezionato.
                </div>
            </Card>
        );
    }
    const total = (revenue.totalCents / 100).toLocaleString(undefined, {
        style: "currency", currency: revenue.currency,
    });
    const arpu = revenue.uniquePayers > 0
        ? (revenue.totalCents / 100 / revenue.uniquePayers).toLocaleString(undefined, {
            style: "currency", currency: revenue.currency,
        })
        : "—";

    return (
        <Card title="Revenue">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <KpiTile label="Totale" value={total} highlight />
                <KpiTile label="Pagamenti" value={revenue.paymentCount.toString()} />
                <KpiTile label="Paganti unici" value={revenue.uniquePayers.toString()} />
                <KpiTile label="ARPU" value={arpu} />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
                <div>
                    <div className="text-xs text-white/50 mb-2">Per piano</div>
                    {revenue.byPlan.length > 0 ? (
                        <ul className="space-y-1">
                            {revenue.byPlan.map((p) => (
                                <li key={p.plan} className="flex justify-between text-xs">
                                    <span className="font-mono text-white/80">{p.plan}</span>
                                    <span className="tabular-nums">
                                        {(p.revenueCents / 100).toLocaleString(undefined, {
                                            style: "currency", currency: revenue.currency,
                                        })}
                                        <span className="text-white/40 ml-2">×{p.count}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : <div className="text-xs text-white/50">—</div>}
                </div>
                <div>
                    <div className="text-xs text-white/50 mb-2">Ultimi pagamenti</div>
                    <ul className="space-y-1">
                        {revenue.recent.map((p, i) => (
                            <li key={i} className="flex justify-between text-xs">
                                <span className="text-white/70 tabular-nums">
                                    {p.timestamp.slice(5, 16).replace("T", " ")}
                                </span>
                                <span className="tabular-nums">
                                    {(p.amountCents / 100).toLocaleString(undefined, {
                                        style: "currency", currency: revenue.currency,
                                    })}
                                    <span className="text-white/40 ml-2">{p.plan}</span>
                                    {p.isFirst && <span className="ml-1 text-emerald-300/80">·new</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Card>
    );
}

function OnboardingFunnelPanel({ rows }: { rows: Overview["onboardingFunnel"] }) {
    const formatDuration = (ms: number | null) => {
        if (ms === null) return "—";
        const seconds = Math.round(ms / 1000);
        return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };
    return (
        <Card title="Onboarding per stage (server-side)">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="text-white/45"><tr className="border-b border-white/10"><th className="pb-2 font-medium">Stage</th><th className="pb-2 font-medium">Entrati</th><th className="pb-2 font-medium">Completati</th><th className="pb-2 font-medium">Conversione</th><th className="pb-2 font-medium">Mediana</th><th className="pb-2 font-medium">P95</th><th className="pb-2 font-medium">Errori</th></tr></thead>
                    <tbody>{rows.map(row => <tr key={row.stage} className="border-b border-white/5 last:border-0"><td className="py-2.5 font-mono text-white/80">{row.stage}</td><td className="py-2.5 tabular-nums">{row.entered}</td><td className="py-2.5 tabular-nums">{row.completed}</td><td className="py-2.5 tabular-nums text-violet-300">{Math.round(row.conversion * 100)}%</td><td className="py-2.5 tabular-nums text-white/60">{formatDuration(row.medianMs)}</td><td className="py-2.5 tabular-nums text-white/60">{formatDuration(row.p95Ms)}</td><td className={`py-2.5 tabular-nums ${row.errors ? "text-red-300" : "text-white/40"}`}>{row.errors}</td></tr>)}</tbody>
                </table>
            </div>
        </Card>
    );
}

function CommunicationsPanel({ data }: { data: Overview["communications"] }) {
    const total = (key: string) => data.totals[key] ?? 0;
    const rate = (value: number, base: number) => base ? `${Math.round(value / base * 100)}%` : "—";
    const sent = total("communications_sent");
    return (
        <Card title="Lifecycle communications">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-5">
                <KpiTile label="Accepted" value={sent.toLocaleString()} />
                <KpiTile label="Delivered" value={`${total("communications_delivered").toLocaleString()} · ${rate(total("communications_delivered"), sent)}`} />
                <KpiTile label="Opened" value={`${total("communications_opened").toLocaleString()} · ${rate(total("communications_opened"), total("communications_delivered"))}`} />
                <KpiTile label="Clicked" value={`${total("communications_clicked").toLocaleString()} · ${rate(total("communications_clicked"), total("communications_delivered"))}`} />
                <KpiTile label="Bounced" value={total("communications_bounced").toLocaleString()} />
                <KpiTile label="Failed" value={total("communications_failed").toLocaleString()} />
                <KpiTile label="Duplicates avoided" value={total("communications_skipped_duplicate").toLocaleString()} />
                <KpiTile label="Users in cooldown" value={data.cooldownUsers.toLocaleString()} />
            </div>
            {data.health.alerts.length > 0 && (
                <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {data.health.alerts.join(" · ")}
                </div>
            )}
            {data.health.alerts.length === 0 && <div className="mb-5 text-xs text-emerald-300/80">Operational health: {data.health.status}</div>}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="overflow-x-auto">
                    <div className="text-xs font-medium text-white/70 mb-2">Delivery by category</div>
                    <table className="w-full text-left text-xs"><thead className="text-white/40"><tr><th className="pb-2">Category</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th></tr></thead><tbody>
                        {data.categories.map(row => <tr key={row.name} className="border-t border-white/5"><td className="py-2 font-mono">{row.name}</td><td>{row.sent}</td><td>{row.delivered}</td><td>{row.opened}</td><td>{row.clicked}</td></tr>)}
                    </tbody></table>
                </div>
                <div className="overflow-x-auto">
                    <div className="text-xs font-medium text-white/70 mb-2">Onboarding resumed within 72h</div>
                    <table className="w-full text-left text-xs"><thead className="text-white/40"><tr><th className="pb-2">Message</th><th>Sent</th><th>Resumed</th><th>Rate</th><th>Avg. delay</th></tr></thead><tbody>
                        {data.types.map(row => <tr key={row.name} className="border-t border-white/5"><td className="py-2 font-mono">{row.name}</td><td>{row.sent}</td><td>{row.attributed}</td><td className="text-violet-300">{Math.round(row.conversion * 100)}%</td><td>{row.avgResumeMs === null ? "—" : `${Math.round(row.avgResumeMs / 3600000 * 10) / 10}h`}</td></tr>)}
                    </tbody></table>
                </div>
            </div>
            {data.recentIssues.length > 0 && <div className="mt-6 overflow-x-auto">
                <div className="text-xs font-medium text-white/70 mb-2">Recent failed or unfinished attempts</div>
                <table className="w-full min-w-[700px] text-left text-xs"><thead className="text-white/40"><tr><th className="pb-2">User</th><th>Message</th><th>Status</th><th>Attempts</th><th>Last error</th></tr></thead><tbody>
                    {data.recentIssues.map((row, index) => <tr key={`${row.userId}-${row.type}-${index}`} className="border-t border-white/5"><td className="py-2 font-mono">{row.userId}</td><td className="font-mono">{row.type}</td><td className={row.status === "failed" ? "text-red-300" : "text-amber-300"}>{row.status}</td><td>{row.attempts}</td><td className="max-w-[360px] truncate text-white/50">{row.error ?? "—"}</td></tr>)}
                </tbody></table>
            </div>}
        </Card>
    );
}

function KpiTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${highlight ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/5"}`}>
            <div className="text-[10px] text-white/50 uppercase tracking-wide">{label}</div>
            <div className={`text-lg font-semibold tabular-nums mt-1 ${highlight ? "text-emerald-300" : "text-white"}`}>
                {value}
            </div>
        </div>
    );
}

// ─── Funnel (with step-to-step drop %) ─────────────────────────────────────

function Funnel({ steps }: { steps: Overview["funnel"] }) {
    const max = Math.max(...steps.map((s) => s.users), 1);
    return (
        <Card title="Funnel conversioni (per utenti)">
            <ul className="space-y-3">
                {steps.map((s) => {
                    const pct = (s.users / max) * 100;
                    const dropPct = s.dropFromPrev !== null ? Math.round(s.dropFromPrev * 100) : null;
                    const retPct = s.retentionFromPrev !== null ? Math.round(s.retentionFromPrev * 100) : null;
                    const isBigDrop = dropPct !== null && dropPct >= 60;
                    return (
                        <li key={s.name} className="space-y-1">
                            <div className="flex justify-between items-baseline text-xs">
                                <span className="text-white/80 font-mono">{s.name}</span>
                                <span className="text-white/60 tabular-nums flex items-center gap-2">
                                    {retPct !== null && (
                                        <span className={isBigDrop ? "text-red-300/90" : "text-white/40"}>
                                            {retPct}% ↓
                                        </span>
                                    )}
                                    <span>{s.users.toLocaleString()} utenti</span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${isBigDrop ? "from-red-400 to-orange-400" : "from-violet-400 to-pink-400"}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

// ─── Top events ─────────────────────────────────────────────────────────────

function TopEvents({ events }: { events: Overview["topEvents"] }) {
    return (
        <Card title="Top eventi">
            <Table
                head={["Evento", "Conteggio", "Utenti"]}
                rows={events.map((e) => [
                    <span key="n" className="font-mono text-xs">{e.name}</span>,
                    <span key="c" className="tabular-nums">{e.count.toLocaleString()}</span>,
                    <span key="u" className="tabular-nums text-white/60">{e.users.toLocaleString()}</span>,
                ])}
            />
        </Card>
    );
}

// ─── Top pages ─────────────────────────────────────────────────────────────

function TopPages({ pages }: { pages: Overview["topPages"] }) {
    return (
        <Card title="Top pagine">
            <Table
                head={["Percorso", "Views", "Utenti", "Durata"]}
                rows={pages.map((p) => [
                    <span key="p" className="font-mono text-xs truncate max-w-[200px] inline-block">{p.path}</span>,
                    <span key="v" className="tabular-nums">{p.views.toLocaleString()}</span>,
                    <span key="u" className="tabular-nums text-white/60">{p.users.toLocaleString()}</span>,
                    <span key="d" className="tabular-nums text-white/60">{formatDuration(p.avgDurationSec)}</span>,
                ])}
            />
        </Card>
    );
}

// ─── Sources ───────────────────────────────────────────────────────────────

function Sources({ sources }: { sources: Overview["sources"] }) {
    return (
        <Card title="Sorgenti di traffico">
            <Table
                head={["Source / Medium", "Sessioni", "Utenti"]}
                rows={sources.map((s) => [
                    <span key="s" className="text-xs">
                        <span className="text-white">{s.source || "(direct)"}</span>
                        <span className="text-white/40"> / {s.medium || "(none)"}</span>
                    </span>,
                    <span key="se" className="tabular-nums">{s.sessions.toLocaleString()}</span>,
                    <span key="u" className="tabular-nums text-white/60">{s.users.toLocaleString()}</span>,
                ])}
            />
        </Card>
    );
}

// ─── Frustration Signals (Microsoft Clarity, daily cache) ─────────────────

function FrustrationPanel({ clarity }: { clarity: Overview["clarity"] }) {
    if (!clarity) {
        return (
            <Card title="Frustration signals (Clarity)">
                <div className="text-sm text-white/50">
                    Snapshot Clarity non ancora disponibile. Il primo refresh parte col daily digest (08:00 UTC).
                </div>
            </Card>
        );
    }
    if (clarity.rateLimitedOrEmpty || clarity.traffic.totalSessions === 0) {
        return (
            <Card title={`Frustration signals · ultimi ${clarity.numOfDays}gg (Clarity)`}>
                <div className="text-sm text-white/50">
                    Nessun dato Clarity per il periodo. Aggiornato {timeAgo(clarity.fetchedAt)}.
                </div>
            </Card>
        );
    }
    const t = clarity.traffic;
    const pct = (n: number) => t.totalSessions > 0 ? Math.round((n / t.totalSessions) * 100) : 0;
    const signals = [
        { label: "Rage clicks", count: t.sessionsWithRageClicks, urls: clarity.topByMetric.rageClicks ?? [], warn: 10 },
        { label: "Dead clicks", count: t.sessionsWithDeadClicks, urls: clarity.topByMetric.deadClicks ?? [], warn: 10 },
        { label: "Quick backs", count: t.sessionsWithQuickBacks, urls: clarity.topByMetric.quickBacks ?? [], warn: 20 },
        { label: "Excessive scroll", count: t.sessionsWithExcessiveScroll, urls: clarity.topByMetric.excessiveScroll ?? [], warn: 15 },
        { label: "Script errors", count: t.sessionsWithScriptErrors, urls: clarity.topByMetric.scriptErrors ?? [], warn: 5 },
        { label: "Error clicks", count: t.sessionsWithErrorClicks, urls: clarity.topByMetric.errorClicks ?? [], warn: 5 },
    ];
    return (
        <Card title={`Frustration signals · ${t.totalSessions} sessioni ultimi ${clarity.numOfDays}gg (Clarity)`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {signals.map((s) => {
                    const p = pct(s.count);
                    const isBad = p >= s.warn;
                    return (
                        <div key={s.label} className={`rounded-lg border p-3 ${isBad ? "border-red-400/40 bg-red-400/5" : "border-white/10 bg-white/5"}`}>
                            <div className="text-[10px] text-white/50 uppercase tracking-wide">{s.label}</div>
                            <div className={`text-lg font-semibold tabular-nums mt-1 ${isBad ? "text-red-300" : "text-white"}`}>
                                {s.count} <span className="text-xs text-white/50">({p}%)</span>
                            </div>
                            {s.urls.length > 0 && (
                                <div className="mt-2 text-[10px] text-white/40 font-mono space-y-0.5">
                                    {s.urls.slice(0, 2).map((u, i) => (
                                        <div key={i} className="truncate">
                                            <span className="text-white/30">{u.count}×</span> {pathOnly(u.url)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-[10px] text-white/40">
                <span>Snapshot refreshed {timeAgo(clarity.fetchedAt)}</span>
                <a href="https://clarity.microsoft.com" target="_blank" rel="noreferrer" className="hover:text-white/70">
                    Apri Clarity per i recordings →
                </a>
            </div>
        </Card>
    );
}

function pathOnly(url: string): string {
    try {
        return new URL(url).pathname || url;
    } catch {
        return url;
    }
}

// ─── Activation & Cohort Retention ─────────────────────────────────────────

function CohortsPanel({ cohorts }: { cohorts: Overview["cohorts"] }) {
    if (cohorts.totalSignups === 0) {
        return <Card title="Activation & retention"><div className="text-sm text-white/50">Nessun utente registrato.</div></Card>;
    }
    return (
        <Card title="Activation & retention">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <KpiTile label="Signups totali" value={cohorts.totalSignups.toString()} />
                <KpiTile label="Activated" value={`${cohorts.activated} (${Math.round(cohorts.activationRate * 100)}%)`} />
                <KpiTile
                    label="Activated <24h"
                    value={`${cohorts.activatedWithin24h} (${Math.round(cohorts.activationRate24h * 100)}%)`}
                    highlight={cohorts.activationRate24h >= 0.2}
                />
                <KpiTile label="Cohorts attive" value={cohorts.weekly.length.toString()} />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-white/50">
                            <th className="font-normal pb-2">Cohort (settimana)</th>
                            <th className="font-normal pb-2 text-right">Signups</th>
                            <th className="font-normal pb-2 text-right">Activated</th>
                            <th className="font-normal pb-2 text-right">&lt;24h</th>
                            <th className="font-normal pb-2 text-right">Ret 1d</th>
                            <th className="font-normal pb-2 text-right">Ret 7d</th>
                            <th className="font-normal pb-2 text-right">Ret 30d</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cohorts.weekly.slice(0, 12).map((c) => (
                            <CohortRow key={c.weekStart} cohort={c} />
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ─── Time-to-X (signup → activation → first email → first payment) ────────

function formatDurationMs(ms: number | null): string {
    if (ms == null) return "—";
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
    if (ms < 86400_000) return `${(ms / 3600_000).toFixed(1)}h`;
    return `${(ms / 86400_000).toFixed(1)}d`;
}

function TimeToXPanel({ data }: { data: Overview["timeToX"] }) {
    const items = [
        { key: "activation", label: "Signup → Activation", b: data.activation, color: "violet" },
        { key: "firstEmailSend", label: "Signup → First email_send", b: data.firstEmailSend, color: "pink" },
        { key: "firstPayment", label: "Signup → First payment", b: data.firstPayment, color: "emerald" },
    ] as const;
    return (
        <Card title="Time-to-X (leading indicators)">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {items.map((it) => (
                    <div key={it.key} className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-white/60 mb-2">{it.label}</div>
                        <div className="flex items-baseline gap-2">
                            <div className={`text-2xl font-semibold tabular-nums ${it.b.sampleSize === 0 ? "text-white/30" : "text-white"}`}>
                                {formatDurationMs(it.b.medianMs)}
                            </div>
                            <div className="text-[10px] text-white/40">median (p50)</div>
                        </div>
                        <div className="mt-2 text-[10px] text-white/50 tabular-nums">
                            p25 {formatDurationMs(it.b.p25Ms)} · p75 {formatDurationMs(it.b.p75Ms)} · n={it.b.sampleSize}
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-[10px] text-white/40 mt-3">
                Shorter is better. Track movement week over week — if median activation drops from 5h to 2h, the onboarding improved.
            </div>
        </Card>
    );
}

// ─── Voice of customer (in-app micro-survey responses) ────────────────────

const SCORE_EMOJI: Record<number, string> = { 1: "😡", 2: "😐", 3: "🙂", 4: "😊", 5: "🤩" };

function FeedbackPanel({ feedback }: { feedback: Overview["feedback"] }) {
    if (feedback.totalResponses === 0) {
        return (
            <Card title="Voice of customer">
                <div className="text-sm text-white/50">
                    No responses yet. The micro-survey appears after a user clicks &quot;Email Sent&quot;.
                </div>
            </Card>
        );
    }
    const max = Math.max(...feedback.distribution.map((d) => d.count), 1);
    return (
        <Card title="Voice of customer">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <div className="flex items-baseline gap-3 mb-4">
                        <div className="text-3xl font-semibold tabular-nums">
                            {feedback.averageScore?.toFixed(2) ?? "—"}
                        </div>
                        <div className="text-xs text-white/50">avg / 5 · {feedback.totalResponses} responses</div>
                    </div>
                    <ul className="space-y-1">
                        {[5, 4, 3, 2, 1].map((s) => {
                            const b = feedback.distribution.find((d) => d.score === s);
                            const count = b?.count ?? 0;
                            const pct = (count / max) * 100;
                            return (
                                <li key={s} className="flex items-center gap-3 text-xs">
                                    <span className="w-6">{SCORE_EMOJI[s]}</span>
                                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-400 to-pink-400" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-8 text-right tabular-nums text-white/60">{count}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div>
                    <div className="text-xs text-white/50 mb-2">Latest comments</div>
                    {feedback.recent.filter((r) => r.comment).length > 0 ? (
                        <ul className="space-y-2">
                            {feedback.recent.filter((r) => r.comment).slice(0, 6).map((r, i) => (
                                <li key={i} className="text-xs border-l-2 border-white/10 pl-3">
                                    <div className="flex justify-between text-white/40 mb-0.5">
                                        <span>{SCORE_EMOJI[r.score]} · {r.source}</span>
                                        <span className="tabular-nums">{r.timestamp.slice(5, 10)}</span>
                                    </div>
                                    <div className="text-white/80">{r.comment}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-xs text-white/40">No comments yet — only star ratings so far.</div>
                    )}
                </div>
            </div>
        </Card>
    );
}

function CohortRow({ cohort: c }: { cohort: Overview["cohorts"]["weekly"][number] }) {
    const pct = (n: number) => c.signups > 0 ? `${Math.round((n / c.signups) * 100)}%` : "—";
    return (
        <tr className="border-t border-white/5">
            <td className="py-2 pr-3 text-white/90 font-mono text-xs">{c.weekStart}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{c.signups}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{c.activated} <span className="text-white/40 text-xs">({pct(c.activated)})</span></td>
            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{pct(c.activatedWithin24h)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{pct(c.returned1d)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{pct(c.returned7d)}</td>
            <td className="py-2 pr-3 text-right tabular-nums text-white/70">{pct(c.returned30d)}</td>
        </tr>
    );
}

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3600_000);
    if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min fa`;
    if (h < 24) return `${h} ore fa`;
    return `${Math.floor(h / 24)} giorni fa`;
}

// ─── Generic primitives ────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-medium text-white/90 mb-4">{title}</h2>
            {children}
        </section>
    );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
    if (rows.length === 0) return <div className="text-sm text-white/50">Nessun dato.</div>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs text-white/50">
                        {head.map((h) => (
                            <th key={h} className="font-normal pb-2">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((cells, i) => (
                        <tr key={i} className="border-t border-white/5">
                            {cells.map((c, j) => (
                                <td key={j} className="py-2 pr-3 text-white/90">{c}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-56 rounded-xl" />
            <div className="grid lg:grid-cols-2 gap-6">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        </div>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
    if (!seconds || seconds < 1) return "0s";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatGaDate(raw: string | undefined): string {
    if (!raw || raw.length !== 8) return raw ?? "";
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}`;
}

function buildAreaChart(trend: Overview["trend"]) {
    const w = 800;
    const h = 220;
    const points = [...trend].sort((a, b) => a.date.localeCompare(b.date));
    const maxY = Math.max(...points.map((p) => p.activeUsers), 1);
    if (points.length === 0) return { path: "", areaPath: "", maxY: 0, points };

    const stepX = points.length > 1 ? w / (points.length - 1) : w;
    const coords = points.map((p, i) => {
        const x = points.length === 1 ? w / 2 : i * stepX;
        const y = h - (p.activeUsers / maxY) * (h - 10) - 5;
        return { x, y };
    });

    const path = coords
        .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
        .join(" ");
    const areaPath = `${path} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

    return { path, areaPath, maxY, points };
}
