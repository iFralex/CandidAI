import { cookies } from "next/headers";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Emails } from "./client";

const SendAllSkeleton = () => (
    <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-10 w-64" />
            <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>

        {/* Email cards skeleton */}
        {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>
        ))}
    </div>
);

async function SendAllContent() {
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/emails", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) {
        throw new Error(String(res.status));
    }
    const data = await res.json();

    if (!data.success)
        throw new Error(data.error);

    return (
        <Emails
            mails={Object.entries(data.data).map(email => ({ ...email[1] as object, companyId: email[0] }))}
            userId={data.userId}
        />
    );
}

const Page = () => {
    return (
        <Suspense fallback={<SendAllSkeleton />}>
            <SendAllContent />
        </Suspense>
    );
};

export default Page;
