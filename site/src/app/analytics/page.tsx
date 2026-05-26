import { AnalyticsDashboardClient } from "./client";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
    // Auth enforced by middleware (HTTP Basic Auth using SESSION_API_KEY)
    return <AnalyticsDashboardClient />;
}
