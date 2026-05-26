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
    funnel: { name: string; count: number; users: number }[];
};

const RANGES: { value: Range; label: string }[] = [
    { value: "7d", label: "Ultimi 7 giorni" },
    { value: "30d", label: "Ultimi 30 giorni" },
    { value: "90d", label: "Ultimi 90 giorni" },
];

const FUNNEL_ORDER = [
    "page_view",
    "signup_attempt",
    "signup_success",
    "onboarding_complete",
    "checkout_open",
    "checkout_submit",
    "checkout_success",
    "email_send",
    "app_download_click",
];

export function AnalyticsDashboardClient() {
    const [range, setRange] = useState<Range>("30d");
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch(`/api/analytics/overview?range=${range}`, { cache: "no-store" })
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
    }, [range]);

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
                    <RangePicker value={range} onChange={setRange} />
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
                        <KpiGrid kpis={data.kpis} />
                        <TrendChart trend={data.trend} />
                        <div className="grid lg:grid-cols-2 gap-6">
                            <Funnel events={data.funnel} />
                            <TopEvents events={data.topEvents} />
                        </div>
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

// ─── Funnel ────────────────────────────────────────────────────────────────

function Funnel({ events }: { events: Overview["funnel"] }) {
    const byName = new Map(events.map((e) => [e.name, e]));
    const rows = FUNNEL_ORDER.map((name) => ({
        name,
        count: byName.get(name)?.count ?? 0,
        users: byName.get(name)?.users ?? 0,
    }));
    const max = Math.max(...rows.map((r) => r.users), 1);

    return (
        <Card title="Funnel conversioni (per utenti)">
            <ul className="space-y-2">
                {rows.map((r) => {
                    const pct = (r.users / max) * 100;
                    return (
                        <li key={r.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-white/80 font-mono">{r.name}</span>
                                <span className="text-white/60 tabular-nums">
                                    {r.users.toLocaleString()} utenti · {r.count.toLocaleString()} eventi
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-400 to-pink-400"
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
