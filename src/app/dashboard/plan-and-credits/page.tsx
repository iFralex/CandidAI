import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PlanAndCreditsClient from "./client";

export default async function PlanAndCreditsPage() {
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

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Plan & Credits</h1>
                <p className="text-gray-400">
                    Upgrade your plan or top up your credits to keep generating personalised outreach emails.
                </p>
            </div>

            <PlanAndCreditsClient email={user.email || ""} />
        </div>
    );
}
