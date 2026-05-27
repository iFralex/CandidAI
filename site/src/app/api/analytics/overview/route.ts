import { NextRequest, NextResponse } from "next/server";
import { runReport, runRealtimeReport, dateRange, GaDateRange } from "@/lib/ga-data-client";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { loadClaritySnapshot } from "@/lib/clarity-data";
import { adminAuth } from "@/lib/firebase-admin";

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

    try {
        const [kpis, trend, topEvents, topPages, sources, customFunnel, realtime, revenue, clarity, cohorts] = await Promise.all([
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
