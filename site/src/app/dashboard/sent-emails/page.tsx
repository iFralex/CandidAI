import { cookies } from "next/headers";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "@/components/dashboardServer";
import { SentEmailsFilter } from "./client";
import { redirect } from "next/navigation";

export const metadata = { title: "Sent Emails" };

type SearchParams = Promise<{ preset?: string; from?: string; to?: string }>;

const isSentTs = (ts: any) => ts?._seconds > 0;

function parseSentCampaigns(rawData: Record<string, any>) {
    const data = { ...rawData };
    delete data.companies_to_confirm;

    return Object.entries(data)
        .filter(([, info]: any) => isSentTs(info?.email_sent))
        .map(([id, info]: any) => {
            const emailSentDate: Date | null = info.email_sent
                ? new Date(info.email_sent._seconds * 1000)
                : null;
            const startDate = info?.start_date
                ? new Date(info.start_date._seconds * 1000 + info.start_date._nanoseconds / 1e6)
                : null;

            return {
                id,
                company: info?.company ?? null,
                recruiterName: info?.recruiter?.name ?? null,
                recruiterTitle: info?.recruiter?.job_title ?? null,
                startDate,
                emailSentDate,
                estimatedCompletion: null,
                status: "sent",
                progress: 100,
                emailsGenerated: 1,
                emailsSent: 1,
                stage: "Email sent",
            };
        });
}

function applyDateFilter(
    campaigns: ReturnType<typeof parseSentCampaigns>,
    preset: string,
    from?: string,
    to?: string
) {
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (preset === "7") {
        fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === "30") {
        fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === "custom") {
        if (from) fromDate = new Date(from);
        if (to) {
            toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
        }
    }

    if (!fromDate && !toDate) return campaigns;

    return campaigns.filter((c) => {
        const d = c.emailSentDate;
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
    });
}

async function SentEmailsData({
    preset,
    from,
    to,
}: {
    preset: string;
    from?: string;
    to?: string;
}) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/protected/results`, {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString(),
        },
    });

    if (!res.ok) redirect("/login");
    const data = await res.json();
    if (!data.success) redirect("/login");

    const allSent = parseSentCampaigns(data.data || {});
    const filtered = applyDateFilter(allSent, preset, from, to);

    return (
        <>
            <SentEmailsFilter preset={preset} from={from} to={to} totalCount={filtered.length} />
            <Results results={filtered} />
        </>
    );
}

export default async function SentEmailsPage({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const preset = params.preset || "all";
    const from = params.from;
    const to = params.to;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Sent Emails</h1>
                <p className="text-gray-400">All campaigns where emails have been sent</p>
            </div>

            <Suspense fallback={<ResultsSkeleton />}>
                <SentEmailsData preset={preset} from={from} to={to} />
            </Suspense>
        </div>
    );
}
