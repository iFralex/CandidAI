import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PlanAndCreditsClient from "./client";

const PlanAndCreditsSkeleton = () => (
    <div className="space-y-12">
        {/* Plans section */}
        <section>
            <div className="mb-6 space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-10 w-32" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((j) => (
                                <Skeleton key={j} className="h-4 w-full" />
                            ))}
                        </div>
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </div>
        </section>

        <div className="border-t border-white/10" />

        {/* Credits section */}
        <section>
            <div className="mb-6 space-y-2">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </div>
        </section>
    </div>
);

async function PlanAndCreditsContent() {
    const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: (await cookies()).toString()
        }
    });

    if (!res.ok) return redirect("/login");

    const data = await res.json();
    if (!data.success) return redirect("/login");

    const user = data.user;
    if (!user) return redirect("/login");

    return <PlanAndCreditsClient email={user.email || ""} />;
}

export default function PlanAndCreditsPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Plan & Credits</h1>
                <p className="text-gray-400">
                    Upgrade your plan or top up your credits to keep generating personalised outreach emails.
                </p>
            </div>

            <Suspense fallback={<PlanAndCreditsSkeleton />}>
                <PlanAndCreditsContent />
            </Suspense>
        </div>
    );
}
