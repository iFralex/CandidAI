import { UserJourneyClient } from "./client";

export const metadata = { title: "Analytics · User" };
export const dynamic = "force-dynamic";

// Auth enforced by middleware (Basic Auth using SESSION_API_KEY) — same as /analytics.
export default function UserJourneyPage() {
    return <UserJourneyClient />;
}
