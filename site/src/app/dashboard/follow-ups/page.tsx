import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MessageCircleReply } from "lucide-react";

import { FollowUpsClient } from "./client";

export const metadata = { title: "Follow Ups" };

export default async function FollowUpsPage() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/follow-ups`, {
        credentials: "include",
        cache: "no-store",
        headers: { cookie: (await cookies()).toString() },
    });
    if (response.status === 401) redirect("/login");
    if (!response.ok) throw new Error(`Failed to fetch follow-ups: ${response.status}`);

    const payload = await response.json();
    if (!payload.success) throw new Error(payload.error || "Failed to fetch follow-ups");
    const enabled = payload.plan === "pro" || payload.plan === "ultra";

    return (
        <div className="space-y-8">
            <header className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/[0.06] p-6 sm:p-9">
                <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
                <div className="relative flex max-w-3xl items-start gap-4">
                    <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300 sm:flex">
                        <MessageCircleReply className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">Response cockpit</p>
                        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Continue the conversations that matter.</h1>
                        <p className="mt-3 max-w-2xl leading-7 text-gray-300">
                            CandidAI watches the timing. You decide when it should write. No follow-up is generated—and no AI cost is incurred—until you request it.
                        </p>
                    </div>
                </div>
            </header>

            <FollowUpsClient campaigns={payload.data || []} enabled={enabled} email={payload.email || ""} />
        </div>
    );
}
