/**
 * ga-data-client.ts
 * Server-only Google Analytics Data API (GA4) client.
 *
 * Auth: reuses the existing Firebase Admin service account.
 * The same service account must be added to the GA4 property
 * (Admin → Property Access Management → role: Viewer).
 *
 * Env required:
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   FIREBASE_ADMIN_PROJECT_ID
 *   GA4_PROPERTY_ID          (numeric, e.g. 412345678 — NOT the G-XXXX measurement id)
 */

import "server-only";
import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";

let cached: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
    if (cached) return cached;

    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;

    if (!clientEmail || !privateKey || !projectId) {
        throw new Error("Missing FIREBASE_ADMIN_* env vars for GA Data API client");
    }

    cached = new BetaAnalyticsDataClient({
        credentials: { client_email: clientEmail, private_key: privateKey },
        projectId,
    });
    return cached;
}

function getPropertyPath(): string {
    const id = process.env.GA4_PROPERTY_ID;
    if (!id) throw new Error("Missing GA4_PROPERTY_ID env var");
    return `properties/${id}`;
}

export type GaDateRange = { startDate: string; endDate: string };

export type GaRow = {
    dimensions: string[];
    metrics: string[];
};

export type GaReport = {
    rows: GaRow[];
    totals: string[];
    rowCount: number;
};

/**
 * Low-level wrapper around runReport. Returns a flat shape that's easier to
 * serialize to JSON for the client. Numeric metrics are kept as strings (the
 * API's native format) — convert with Number() in the caller.
 */
export async function runReport(opts: {
    dateRanges: GaDateRange[];
    dimensions?: string[];
    metrics: string[];
    orderBys?: protos.google.analytics.data.v1beta.IOrderBy[];
    limit?: number;
    dimensionFilter?: protos.google.analytics.data.v1beta.IFilterExpression;
}): Promise<GaReport> {
    const client = getClient();
    const [response] = await client.runReport({
        property: getPropertyPath(),
        dateRanges: opts.dateRanges,
        dimensions: opts.dimensions?.map((name) => ({ name })),
        metrics: opts.metrics.map((name) => ({ name })),
        orderBys: opts.orderBys,
        limit: opts.limit,
        dimensionFilter: opts.dimensionFilter,
    });

    const rows: GaRow[] = (response.rows ?? []).map((r) => ({
        dimensions: (r.dimensionValues ?? []).map((v) => v.value ?? ""),
        metrics: (r.metricValues ?? []).map((v) => v.value ?? "0"),
    }));

    const totals = (response.totals?.[0]?.metricValues ?? []).map((v) => v.value ?? "0");

    return { rows, totals, rowCount: response.rowCount ?? rows.length };
}

/** Convenience date-range presets. */
export const dateRange = {
    last7Days: (): GaDateRange => ({ startDate: "7daysAgo", endDate: "today" }),
    last30Days: (): GaDateRange => ({ startDate: "30daysAgo", endDate: "today" }),
    last90Days: (): GaDateRange => ({ startDate: "90daysAgo", endDate: "today" }),
    today: (): GaDateRange => ({ startDate: "today", endDate: "today" }),
    yesterday: (): GaDateRange => ({ startDate: "yesterday", endDate: "yesterday" }),
    dayBeforeYesterday: (): GaDateRange => ({ startDate: "2daysAgo", endDate: "2daysAgo" }),
};

/**
 * GA4 Realtime report (last 30 minutes by default).
 * No dateRanges param — GA4 hard-codes the window.
 */
export async function runRealtimeReport(opts: {
    dimensions?: string[];
    metrics: string[];
    limit?: number;
}): Promise<GaReport> {
    const client = getClient();
    const [response] = await client.runRealtimeReport({
        property: getPropertyPath(),
        dimensions: opts.dimensions?.map((name) => ({ name })),
        metrics: opts.metrics.map((name) => ({ name })),
        limit: opts.limit,
    });
    const rows: GaRow[] = (response.rows ?? []).map((r) => ({
        dimensions: (r.dimensionValues ?? []).map((v) => v.value ?? ""),
        metrics: (r.metricValues ?? []).map((v) => v.value ?? "0"),
    }));
    const totals = (response.totals?.[0]?.metricValues ?? []).map((v) => v.value ?? "0");
    return { rows, totals, rowCount: response.rowCount ?? rows.length };
}
