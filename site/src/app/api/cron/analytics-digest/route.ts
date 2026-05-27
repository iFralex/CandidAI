/**
 * Daily analytics digest — runs on a Vercel Cron and emails a summary
 * of yesterday's activity (vs. day-before-yesterday for delta) to the
 * team inbox. Sent via Resend.
 *
 * Auth: Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
 * Falls back to SESSION_API_KEY so the endpoint can be triggered by
 * hand from the same machine that has /analytics access.
 *
 * Manual test:
 *   curl -H "Authorization: Bearer $SESSION_API_KEY" \
 *     https://candidai.tech/api/cron/analytics-digest
 */
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { Timestamp } from "firebase-admin/firestore";
import { runReport, dateRange, GaDateRange } from "@/lib/ga-data-client";
import { adminDb } from "@/lib/firebase-admin";
import {
    fetchClarityLiveInsights,
    saveClaritySnapshot,
    loadClaritySnapshot,
    type ClaritySnapshot,
} from "@/lib/clarity-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIGEST_TO = "hello@candidai.tech";
const DIGEST_FROM = "CandidAI Digest <no-reply@candidai.tech>";

function isAuthorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return false;
    return token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        // 1. Refresh Clarity FIRST (so the digest email can include frustration
        //    signals). Failure here is non-fatal — we fall back to the previous
        //    cached snapshot, or skip the section.
        let clarity: ClaritySnapshot | null = null;
        try {
            clarity = await fetchClarityLiveInsights(3);
            await saveClaritySnapshot(clarity);
        } catch (err) {
            console.error("Clarity refresh failed (falling back to cache):", err);
            clarity = await loadClaritySnapshot().catch(() => null);
        }

        const data = await buildDigestData(clarity);
        const html = renderDigestHtml(data);
        const subject = renderDigestSubject(data);

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
            from: DIGEST_FROM,
            to: DIGEST_TO,
            subject,
            html,
        });
        if (error) throw new Error(JSON.stringify(error));

        return NextResponse.json({ ok: true, subject, kpis: data.kpis });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Analytics digest failed:", message);
        return NextResponse.json({ error: "digest_failed", message }, { status: 500 });
    }
}

// ─── Data ──────────────────────────────────────────────────────────────────

type DigestData = Awaited<ReturnType<typeof buildDigestData>>;

async function buildDigestData(clarity: ClaritySnapshot | null) {
    const [kpisY, kpisD, funnelY, topErrorsY, serverFailsY, revenueY] = await Promise.all([
        kpisFor(dateRange.yesterday()),
        kpisFor(dateRange.dayBeforeYesterday()),
        funnelFor(dateRange.yesterday()),
        recentEventsByName("app_error", since(1, 2), 200),
        recentEventsByName("server_company_step_failed", since(1, 2), 100),
        revenueFor(since(1, 2), sinceEndOfYesterday()),
    ]);

    return {
        date: new Date(Date.now() - 86400_000).toISOString().slice(0, 10),
        kpis: kpisY,
        kpisPrev: kpisD,
        funnel: funnelY,
        topErrors: groupAndTop(topErrorsY, (e) => String(e.params?.error_message ?? "?").slice(0, 100), 5),
        topServerFails: groupAndTop(serverFailsY, (e) => `${e.params?.step ?? "?"} · ${e.params?.company ?? "?"}`, 5),
        revenue: revenueY,
        clarity,
    };
}

function since(daysAgoStart: number, daysAgoEnd: number) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - daysAgoStart);
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() - (daysAgoEnd - 1));
    return Timestamp.fromDate(start);
}
function sinceEndOfYesterday() {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    return Timestamp.fromDate(end);
}

async function kpisFor(dr: GaDateRange) {
    const r = await runReport({
        dateRanges: [dr],
        metrics: ["activeUsers", "newUsers", "sessions", "screenPageViews", "eventCount"],
    });
    const t = r.totals;
    return {
        users: Number(t[0] ?? 0),
        newUsers: Number(t[1] ?? 0),
        sessions: Number(t[2] ?? 0),
        pageViews: Number(t[3] ?? 0),
        events: Number(t[4] ?? 0),
    };
}

const FUNNEL = [
    "page_view", "signup_attempt", "signup_success",
    "onboarding_complete", "checkout_open", "checkout_success", "email_send",
] as const;

async function funnelFor(dr: GaDateRange) {
    const r = await runReport({
        dateRanges: [dr],
        dimensions: ["eventName"],
        metrics: ["totalUsers"],
        dimensionFilter: {
            filter: { fieldName: "eventName", inListFilter: { values: [...FUNNEL] } },
        },
    });
    const map = new Map(r.rows.map((row) => [row.dimensions[0], Number(row.metrics[0])]));
    let prev: number | null = null;
    return FUNNEL.map((name) => {
        const users = map.get(name) ?? 0;
        const drop = prev && prev > 0 ? 1 - users / prev : null;
        prev = users;
        return { name, users, dropFromPrev: drop };
    });
}

async function recentEventsByName(event: string, startTs: Timestamp, limit: number) {
    const snap = await adminDb
        .collection("analytics_events")
        .orderBy("timestamp", "desc")
        .limit(limit * 5) // overfetch to filter in memory
        .get();
    const out: { params?: Record<string, unknown> }[] = [];
    for (const d of snap.docs) {
        const data = d.data();
        if (data.event !== event) continue;
        const ts = data.timestamp as Timestamp | undefined;
        if (!ts || ts.toMillis() < startTs.toMillis()) continue;
        out.push({ params: data.params });
        if (out.length >= limit) break;
    }
    return out;
}

function groupAndTop<T>(items: T[], key: (x: T) => string, n: number) {
    const counts = new Map<string, number>();
    for (const it of items) {
        const k = key(it);
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([label, count]) => ({ label, count }));
}

async function revenueFor(startTs: Timestamp, endTs: Timestamp) {
    const snap = await adminDb
        .collection("analytics_events")
        .orderBy("timestamp", "desc")
        .limit(2000)
        .get();
    let totalCents = 0, count = 0, firstPurchase = 0;
    const payers = new Set<string>();
    for (const d of snap.docs) {
        const data = d.data();
        if (data.event !== "payment_succeeded") continue;
        const ts = data.timestamp as Timestamp | undefined;
        if (!ts || ts.toMillis() < startTs.toMillis() || ts.toMillis() >= endTs.toMillis()) continue;
        const p = (data.params ?? {}) as Record<string, unknown>;
        totalCents += Number(p.amount_cents ?? 0);
        count++;
        if (p.is_first_purchase) firstPurchase++;
        if (data.user_id) payers.add(String(data.user_id));
    }
    return { totalCents, count, payers: payers.size, firstPurchase };
}

// ─── Render ────────────────────────────────────────────────────────────────

function renderDigestSubject(d: DigestData): string {
    const u = d.kpis.users;
    const r = d.revenue.totalCents > 0 ? ` · €${(d.revenue.totalCents / 100).toFixed(0)} rev` : "";
    return `CandidAI · ${d.date} · ${u} utenti${r}`;
}

function delta(now: number, prev: number): string {
    if (prev === 0) return now > 0 ? "<span style='color:#22c55e'>nuovo</span>" : "—";
    const pct = Math.round(((now - prev) / prev) * 100);
    const color = pct >= 0 ? "#22c55e" : "#ef4444";
    const sign = pct >= 0 ? "+" : "";
    return `<span style="color:${color}">${sign}${pct}%</span>`;
}

function renderDigestHtml(d: DigestData): string {
    const kpiRow = (label: string, now: number, prev: number) => `
        <tr>
            <td style="padding:6px 12px;color:#666;font-size:13px">${label}</td>
            <td style="padding:6px 12px;text-align:right;font-weight:600">${now.toLocaleString()}</td>
            <td style="padding:6px 12px;text-align:right;font-size:13px">${delta(now, prev)}</td>
        </tr>`;

    const funnelRow = (s: { name: string; users: number; dropFromPrev: number | null }) => {
        const ret = s.dropFromPrev !== null ? `${Math.round((1 - s.dropFromPrev) * 100)}%` : "—";
        const flag = s.dropFromPrev !== null && s.dropFromPrev >= 0.6 ? " 🔴" : "";
        return `<tr>
            <td style="padding:4px 12px;font-family:monospace;font-size:12px">${s.name}</td>
            <td style="padding:4px 12px;text-align:right;font-weight:600">${s.users}</td>
            <td style="padding:4px 12px;text-align:right;font-size:12px;color:#666">${ret}${flag}</td>
        </tr>`;
    };

    const listRows = (items: { label: string; count: number }[]) =>
        items.length > 0
            ? items.map((i) => `<tr><td style="padding:4px 12px;font-size:12px">[${i.count}] ${escapeHtml(i.label)}</td></tr>`).join("")
            : `<tr><td style="padding:4px 12px;font-size:12px;color:#999">—</td></tr>`;

    const rev = d.revenue;
    const revHtml = rev.count > 0
        ? `€${(rev.totalCents / 100).toFixed(2)} · ${rev.count} pagamenti · ${rev.payers} paganti unici · ${rev.firstPurchase} primi acquisti`
        : `Nessun pagamento ieri`;

    const clarityHtml = renderClaritySection(d.clarity);

    return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;border:1px solid #eee;padding:20px">
    <div style="font-size:12px;color:#888;letter-spacing:0.05em;text-transform:uppercase">CandidAI · daily digest</div>
    <h1 style="margin:4px 0 20px;font-size:22px">${d.date}</h1>

    <h2 style="font-size:14px;color:#666;margin:0 0 8px">KPI (vs. avant'ieri)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">
        ${kpiRow("Utenti attivi", d.kpis.users, d.kpisPrev.users)}
        ${kpiRow("Nuovi utenti", d.kpis.newUsers, d.kpisPrev.newUsers)}
        ${kpiRow("Sessioni", d.kpis.sessions, d.kpisPrev.sessions)}
        ${kpiRow("Page views", d.kpis.pageViews, d.kpisPrev.pageViews)}
        ${kpiRow("Eventi totali", d.kpis.events, d.kpisPrev.events)}
    </table>

    <h2 style="font-size:14px;color:#666;margin:20px 0 8px">Revenue</h2>
    <div style="padding:12px;background:#f5f9f5;border-radius:8px;font-size:14px">${revHtml}</div>

    <h2 style="font-size:14px;color:#666;margin:20px 0 8px">Funnel (retention dal passo precedente)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${d.funnel.map(funnelRow).join("")}</table>

    <h2 style="font-size:14px;color:#666;margin:20px 0 8px">Top errori client (app_error)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${listRows(d.topErrors)}</table>

    <h2 style="font-size:14px;color:#666;margin:20px 0 8px">Top fallimenti pipeline (server)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${listRows(d.topServerFails)}</table>

    ${clarityHtml}

    <div style="margin-top:24px;text-align:center;font-size:11px;color:#aaa">
        <a href="https://candidai.tech/analytics" style="color:#888">Apri dashboard completa →</a>
    </div>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderClaritySection(c: ClaritySnapshot | null): string {
    if (!c || c.rateLimitedOrEmpty || c.traffic.totalSessions === 0) {
        return `<h2 style="font-size:14px;color:#666;margin:20px 0 8px">Frustration signals (Clarity)</h2>
            <div style="padding:12px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#999">
                Nessun dato Clarity disponibile per gli ultimi ${c?.numOfDays ?? 3} giorni.
            </div>`;
    }
    const t = c.traffic;
    const pct = (n: number) => t.totalSessions > 0 ? `${Math.round((n / t.totalSessions) * 100)}%` : "0%";
    const rageList = (c.topByMetric.rageClicks ?? []).slice(0, 3);
    const deadList = (c.topByMetric.deadClicks ?? []).slice(0, 3);
    return `
    <h2 style="font-size:14px;color:#666;margin:20px 0 8px">Frustration signals · ultimi ${c.numOfDays}gg (Clarity)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">
        <tr><td style="padding:4px 12px;font-size:12px;color:#666">Sessioni totali</td>
            <td style="padding:4px 12px;text-align:right;font-weight:600">${t.totalSessions}</td></tr>
        <tr><td style="padding:4px 12px;font-size:12px;color:#666">Sessioni con rage clicks</td>
            <td style="padding:4px 12px;text-align:right">${t.sessionsWithRageClicks} (${pct(t.sessionsWithRageClicks)})</td></tr>
        <tr><td style="padding:4px 12px;font-size:12px;color:#666">Sessioni con dead clicks</td>
            <td style="padding:4px 12px;text-align:right">${t.sessionsWithDeadClicks} (${pct(t.sessionsWithDeadClicks)})</td></tr>
        <tr><td style="padding:4px 12px;font-size:12px;color:#666">Sessioni con quick backs</td>
            <td style="padding:4px 12px;text-align:right">${t.sessionsWithQuickBacks} (${pct(t.sessionsWithQuickBacks)})</td></tr>
        <tr><td style="padding:4px 12px;font-size:12px;color:#666">Sessioni con script errors</td>
            <td style="padding:4px 12px;text-align:right">${t.sessionsWithScriptErrors} (${pct(t.sessionsWithScriptErrors)})</td></tr>
    </table>
    ${rageList.length > 0 ? `<div style="font-size:11px;color:#999;margin-top:6px">Top rage clicks: ${rageList.map(r => `${escapeHtml(r.url)} (${r.count})`).join(" · ")}</div>` : ""}
    ${deadList.length > 0 ? `<div style="font-size:11px;color:#999;margin-top:2px">Top dead clicks: ${deadList.map(r => `${escapeHtml(r.url)} (${r.count})`).join(" · ")}</div>` : ""}
    `;
}
