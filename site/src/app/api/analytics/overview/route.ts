import { NextRequest, NextResponse } from "next/server";
import { runReport, dateRange, GaDateRange } from "@/lib/ga-data-client";

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

export async function GET(req: NextRequest) {
    const range: Range = (req.nextUrl.searchParams.get("range") as Range) || "30d";
    const dr = rangeFor(range);

    try {
        const [kpis, trend, topEvents, topPages, sources, customFunnel] = await Promise.all([
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
                        inListFilter: {
                            values: [
                                "page_view",
                                "signup_attempt",
                                "signup_success",
                                "onboarding_complete",
                                "checkout_open",
                                "checkout_submit",
                                "checkout_success",
                                "email_send",
                                "app_download_click",
                            ],
                        },
                    },
                },
            }),
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
            funnel: customFunnel.rows.map((r) => ({
                name: r.dimensions[0],
                count: Number(r.metrics[0]),
                users: Number(r.metrics[1]),
            })),
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
