/**
 * Microsoft Clarity Data Export API client.
 *
 * Rate limit: 10 requests / day per token. Always go through the daily-refresh
 * cron, never call this from a user-facing route. Reads come from a Firestore
 * cache snapshot (analytics_cache/clarity_latest) that the cron rewrites once
 * per day.
 *
 * Docs: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */
import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const CLARITY_URL = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
export const CLARITY_CACHE_DOC = "analytics_cache/clarity_latest";

interface ClarityMetricRow {
    dimension1Value?: string | null;
    dimension2Value?: string | null;
    dimension3Value?: string | null;
    [key: string]: unknown;
}
interface ClarityMetric {
    metricName: string;
    information: ClarityMetricRow[];
}

/** What we save to Firestore (cached snapshot, consumed by dashboard + digest). */
export interface ClaritySnapshot {
    fetchedAt: string;                  // ISO timestamp of the API call
    numOfDays: number;                  // 1-3 (Clarity API max)
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
    rateLimitedOrEmpty: boolean;        // true if API returned empty / errored
}

const METRIC_TO_TOP_KEY: Record<string, string> = {
    DeadClickCount: "deadClicks",
    RageClickCount: "rageClicks",
    ExcessiveScroll: "excessiveScroll",
    QuickbackClick: "quickBacks",
    ScriptErrorCount: "scriptErrors",
    ErrorClickCount: "errorClicks",
};

/**
 * Fetch fresh data from Clarity API. Uses ONE of the 10 daily requests.
 * Pass the result to `saveClaritySnapshot` to cache for the dashboard.
 */
export async function fetchClarityLiveInsights(numOfDays: 1 | 2 | 3 = 3): Promise<ClaritySnapshot> {
    const token = process.env.CLARITY_API_TOKEN;
    if (!token) throw new Error("CLARITY_API_TOKEN not set");

    const url = `${CLARITY_URL}?numOfDays=${numOfDays}&dimension1=URL`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Clarity API ${res.status}: ${body.slice(0, 200)}`);
    }

    const metrics = (await res.json()) as ClarityMetric[];
    return parseClarityResponse(metrics, numOfDays);
}

function parseClarityResponse(metrics: ClarityMetric[], numOfDays: number): ClaritySnapshot {
    const byName = new Map(metrics.map((m) => [m.metricName, m.information ?? []]));
    const trafficRow = (byName.get("Traffic") ?? [])[0] as Record<string, unknown> | undefined;

    const engagementRow = (byName.get("EngagementTime") ?? [])[0] as Record<string, unknown> | undefined;
    const scrollDepthRow = (byName.get("ScrollDepth") ?? [])[0] as Record<string, unknown> | undefined;

    const topByMetric: Record<string, { url: string; count: number }[]> = {};
    for (const [apiName, friendlyKey] of Object.entries(METRIC_TO_TOP_KEY)) {
        const rows = byName.get(apiName) ?? [];
        topByMetric[friendlyKey] = rows
            .map((r) => ({
                url: String(r.dimension1Value ?? "(no url)"),
                count: Number(r.count ?? r.subTotal ?? 0),
            }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    const allRowsEmpty = metrics.every((m) => !m.information || m.information.length === 0);

    return {
        fetchedAt: new Date().toISOString(),
        numOfDays,
        traffic: {
            totalSessions: Number(trafficRow?.totalSessionCount ?? 0),
            sessionsWithRageClicks: Number(trafficRow?.sessionsWithRageClicks ?? 0),
            sessionsWithDeadClicks: Number(trafficRow?.sessionsWithDeadClicks ?? 0),
            sessionsWithExcessiveScroll: Number(trafficRow?.sessionsWithExcessiveScroll ?? 0),
            sessionsWithQuickBacks: Number(trafficRow?.sessionsWithQuickBacks ?? 0),
            sessionsWithScriptErrors: Number(trafficRow?.sessionsWithScriptErrors ?? 0),
            sessionsWithErrorClicks: Number(trafficRow?.sessionsWithErrorClicks ?? 0),
            botSessions: trafficRow?.botSessions != null ? Number(trafficRow.botSessions) : null,
            averageEngagementTimeMs: engagementRow?.averageEngagementTime != null
                ? Number(engagementRow.averageEngagementTime) : null,
            averageScrollDepth: scrollDepthRow?.averageScrollDepth != null
                ? Number(scrollDepthRow.averageScrollDepth) : null,
        },
        topByMetric,
        rateLimitedOrEmpty: allRowsEmpty,
    };
}

/** Persist the snapshot to Firestore (single doc, overwritten each day). */
export async function saveClaritySnapshot(snap: ClaritySnapshot): Promise<void> {
    const [collection, docId] = CLARITY_CACHE_DOC.split("/");
    await adminDb.collection(collection).doc(docId).set({
        ...snap,
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/** Read the cached snapshot. Returns null if never written yet. */
export async function loadClaritySnapshot(): Promise<ClaritySnapshot | null> {
    const [collection, docId] = CLARITY_CACHE_DOC.split("/");
    const snap = await adminDb.collection(collection).doc(docId).get();
    if (!snap.exists) return null;
    return snap.data() as ClaritySnapshot;
}
