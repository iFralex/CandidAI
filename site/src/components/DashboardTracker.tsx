"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

interface DashboardTrackerProps {
    campaignCount: number;
    plan: string;
}

export function DashboardTracker({ campaignCount, plan }: DashboardTrackerProps) {
    useEffect(() => {
        track({ name: "dashboard_view", params: { campaign_count: campaignCount, plan } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
