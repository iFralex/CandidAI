"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { track } from "@/lib/analytics";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AmbassadorPromo({ placement, className }: { placement: "homepage" | "dashboard"; className?: string }) {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-purple-500/[0.07] to-fuchsia-500/10 p-6 sm:p-8",
            className,
        )}>
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div className="max-w-2xl">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                        <Users className="h-4 w-4" /> CandidAI Ambassador Program
                    </div>
                    <h2 className="text-2xl font-bold text-white sm:text-3xl">Share CandidAI. Earn up to 20%.</h2>
                    <p className="mt-3 leading-relaxed text-gray-400">
                        Help job seekers discover a more direct path to recruiters and earn commissions on qualifying purchases through your personal link or QR code.
                    </p>
                </div>
                <Link
                    href="/referral"
                    className={buttonVariants({ size: "md", className: "shrink-0 whitespace-normal text-center" })}
                    onClick={() => track({
                        name: "referral_cta_click",
                        params: { button_label: "Explore Ambassador Program", section: placement },
                    })}
                >
                    Explore the program <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}
