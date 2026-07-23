"use client";

import { useEffect } from "react";
import { Bell, CheckCircle2, Clock3, MessageCircleReply, Sparkles } from "lucide-react";

import { CreditsDialog } from "@/app/dashboard/[id]/client";
import { FollowUpCampaign, FollowUpPanel } from "@/components/FollowUpPanel";
import { Card } from "@/components/ui/card";
import { track } from "@/lib/analytics";

function timestampMillis(value: any) {
    return Number(value?._seconds ?? value?.seconds ?? 0) * 1000;
}

function addWorkingDays(timestamp: number, days: number) {
    const date = new Date(timestamp);
    let remaining = days;
    while (remaining > 0) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1;
    }
    return date.getTime();
}

function isReady(campaign: FollowUpCampaign) {
    const reminder = timestampMillis(campaign.follow_up_reminder_at);
    if (reminder > Date.now()) return false;
    return addWorkingDays(timestampMillis(campaign.email_sent), 5) <= Date.now();
}

export function FollowUpsClient({
    campaigns,
    enabled,
    email,
}: {
    campaigns: FollowUpCampaign[];
    enabled: boolean;
    email?: string;
}) {
    useEffect(() => {
        track({
            name: "campaign_view",
            params: { result_id: "follow-ups", status: campaigns.length ? "in_progress" : "pending" },
        });
    }, [campaigns.length]);

    const visible = campaigns.filter((campaign) =>
        !["dismissed", "replied"].includes(campaign.follow_up_disposition || ""),
    );
    const sent = visible.filter((campaign) => campaign.follow_up?.status === "sent");
    const drafts = visible.filter((campaign) => campaign.follow_up?.current && campaign.follow_up?.status !== "sent");
    const ready = visible.filter((campaign) => !campaign.follow_up?.current && isReady(campaign));
    const waiting = visible.filter((campaign) => !campaign.follow_up?.current && !isReady(campaign));
    const ordered = [...ready, ...drafts, ...waiting];
    const primary = ordered[0];
    const remaining = ordered.slice(1);

    const paidAction = (
        _trigger: React.ReactNode,
        action: () => Promise<{ success: boolean; error?: string }>,
        onSuccess: () => void | Promise<void>,
    ) => (
        <CreditsDialog
            contentType="follow-up"
            unlocked={false}
            action={action}
            email={email}
            onSuccess={onSuccess}
            className="contents"
        >
            <span className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105">
                Continue · 50 credits
                <Sparkles className="ml-2 h-4 w-4" />
            </span>
        </CreditsDialog>
    );

    if (!campaigns.length) {
        return (
            <Card hover={false} className="relative overflow-hidden border-violet-500/20 p-8 text-center sm:p-14">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
                    <MessageCircleReply className="h-8 w-8" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">Your conversations will appear here.</h2>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-gray-400">
                    Send your first recruiter email from a campaign. CandidAI will then watch the timing without generating or spending anything.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
                <Card hover={false} className="p-5">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-400">Worth continuing</p><p className="mt-1 text-3xl font-semibold text-white">{ready.length}</p></div>
                        <Bell className="h-6 w-6 text-violet-400" />
                    </div>
                </Card>
                <Card hover={false} className="p-5">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-400">Drafts ready</p><p className="mt-1 text-3xl font-semibold text-white">{drafts.length}</p></div>
                        <Sparkles className="h-6 w-6 text-amber-300" />
                    </div>
                </Card>
                <Card hover={false} className="p-5">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-gray-400">Follow-ups sent</p><p className="mt-1 text-3xl font-semibold text-white">{sent.length}</p></div>
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    </div>
                </Card>
            </div>

            {primary && (
                <section>
                    <div className="mb-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-300">Best next move</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">Start with this conversation.</h2>
                    </div>
                    <FollowUpPanel campaign={primary} enabled={enabled} email={email} renderPaidAction={paidAction} />
                </section>
            )}

            {remaining.length > 0 && (
                <section>
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Your other conversations</p>
                            <h2 className="mt-2 text-2xl font-semibold text-white">Next in line</h2>
                        </div>
                        <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
                            <Clock3 className="h-4 w-4" /> Ordered by timing
                        </div>
                    </div>
                    <div className="space-y-4">
                        {remaining.map((campaign) => (
                            <FollowUpPanel
                                key={campaign.id}
                                campaign={campaign}
                                enabled={enabled}
                                email={email}
                                compact
                                renderPaidAction={paidAction}
                            />
                        ))}
                    </div>
                </section>
            )}

            {sent.length > 0 && (
                <section>
                    <div className="mb-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/70">Completed</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">Follow-ups sent</h2>
                    </div>
                    <div className="space-y-4">
                        {sent.map((campaign) => (
                            <FollowUpPanel
                                key={campaign.id}
                                campaign={campaign}
                                enabled={enabled}
                                email={email}
                                compact
                                renderPaidAction={paidAction}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
