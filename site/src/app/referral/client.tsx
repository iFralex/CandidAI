"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Caveat } from "next/font/google";
import {
    Sparkles, TrendingUp, Zap, Rocket, Crown, ArrowRight, Check, X,
    QrCode, Gift, Shirt, Award, Sticker, StickyNote, GraduationCap,
    Presentation, Mail, Pin, Sparkle, Archive, Share2, Users, Trophy,
    Newspaper, Stamp, BookOpen, Megaphone, FileX, Scissors, ChevronDown,
} from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { plansInfo } from "@/config";
import { computePriceInCents, formatPrice } from "@/lib/utils";
import { computeReferralEarnings } from "@/lib/referral";

const caveat = Caveat({
    variable: "--font-caveat",
    subsets: ["latin"],
    weight: ["500", "600", "700"],
});

// ---------- Data ----------

const COMMISSION_TIERS = [
    { range: "Sales 1–5", rate: "5%", note: "Your first five conversions", icon: TrendingUp },
    { range: "Sales 6–15", rate: "10%", note: "Ten more at double the rate", icon: Zap },
    { range: "Sales 16–30", rate: "15%", note: "Fifteen more, compounding", icon: Rocket },
    { range: "Sales 31+", rate: "20%", note: "Every sale after that, forever", icon: Crown },
];

// ---------- Sections ----------

const HeroSection = () => {
    return (
        <section className="relative overflow-hidden bg-[#080510] pt-32 pb-20 px-6 lg:px-8">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-purple-900/10 to-transparent pointer-events-none" />
            <div className="relative max-w-5xl mx-auto text-center">
                <Badge
                    variant="default"
                    className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full backdrop-blur-sm mb-8"
                >
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    Ambassador Program
                </Badge>

                <h1 className="font-black leading-[0.95] mb-6 tracking-tight text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                    <span className="block text-[clamp(2.5rem,5.5vw,4.5rem)]">Get Paid to Kill</span>
                    <span className="block text-[clamp(2.5rem,5.5vw,4.5rem)] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                        the LinkedIn Application
                    </span>
                </h1>

                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                    Bring people to CandidAI and earn up to{" "}
                    <span className="text-violet-300 font-medium">20% on every sale</span>. Apply and we'll ship you a
                    full guerrilla-marketing kit — hundreds of stickers and props included, you only cover shipping.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                        size="lg"
                        icon={<ArrowRight className="w-4 h-4" />}
                        onClick={() => {
                            track({ name: "referral_cta_click", params: { button_label: "Apply to become an Ambassador", section: "hero" } });
                            document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
                        }}
                    >
                        Apply to become an Ambassador
                    </Button>
                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => document.getElementById("tiers")?.scrollIntoView({ behavior: "smooth" })}
                    >
                        See how the payout works
                    </Button>
                </div>
            </div>
        </section>
    );
};

const TiersSection = () => {
    return (
        <section id="tiers" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        The More You Sell, the More You Keep
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Commissions stack automatically. No renegotiating, no resetting — every sale pushes you up.
                    </p>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                    {COMMISSION_TIERS.map((tier, index) => {
                        const Icon = tier.icon;
                        return (
                            <motion.div
                                key={tier.range}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Card className="p-6 pt-8 h-full relative border-dashed border-t-2 border-t-white/20">
                                    <div className="absolute -top-3 left-6 bg-black px-2 flex items-center gap-1 text-gray-600 text-[10px] uppercase tracking-widest">
                                        <Scissors className="w-3 h-3" />
                                        tear here
                                    </div>
                                    <Icon className="w-8 h-8 text-violet-400 mb-4" />
                                    <div className="text-3xl font-bold text-white mb-1">{tier.rate}</div>
                                    <div className="text-gray-300 font-medium mb-2">{tier.range}</div>
                                    <div className="text-gray-500 text-sm">{tier.note}</div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

const SIMULATOR_PRESETS = [10, 25, 50];

const EarningsSimulatorSection = () => {
    const paidPlans = plansInfo.filter((p) => p.id !== "free_trial");
    const [planId, setPlanId] = useState("pro");
    const [count, setCount] = useState(20);

    const priceCents = computePriceInCents("plan", planId);
    const result = useMemo(() => computeReferralEarnings(count, priceCents), [count, priceCents]);

    return (
        <section className="relative py-24 px-6 lg:px-8 bg-black">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Run the Numbers Yourself
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Pick a plan, pick a volume, see what it's worth.
                    </p>
                </div>

                <Card className="p-8 md:p-10" gradient>
                    <div className="grid md:grid-cols-2 gap-10">
                        <div>
                            <label className="text-sm text-gray-400 uppercase tracking-widest mb-3 block">
                                Plan your referrals buy
                            </label>
                            <div className="flex gap-3 mb-8">
                                {paidPlans.map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => setPlanId(plan.id)}
                                        className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all border ${
                                            planId === plan.id
                                                ? "bg-violet-500/20 border-violet-500 text-white"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                                        }`}
                                    >
                                        {plan.name}
                                        <div className="text-xs font-normal mt-1 opacity-70">
                                            {formatPrice(computePriceInCents("plan", plan.id))}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <label className="text-sm text-gray-400 uppercase tracking-widest mb-3 block">
                                Purchases through your link
                            </label>
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={() => setCount((c) => Math.max(0, c - 1))}
                                    className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center text-lg"
                                    aria-label="Decrease"
                                >
                                    −
                                </button>
                                <div className="flex-1 text-center text-2xl font-bold text-white">{count}</div>
                                <button
                                    onClick={() => setCount((c) => Math.min(200, c + 1))}
                                    className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center text-lg"
                                    aria-label="Increase"
                                >
                                    +
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {SIMULATOR_PRESETS.map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => setCount(preset)}
                                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                                    >
                                        {preset} referrals
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-black/30 rounded-xl p-6">
                            <div className="text-gray-400 text-sm mb-1">Estimated earnings</div>
                            <div className="text-4xl font-bold text-green-400 mb-6">{formatPrice(result.totalCents)}</div>

                            <div className="space-y-2">
                                {result.breakdown
                                    .filter((tier) => tier.count > 0)
                                    .map((tier) => (
                                        <div key={tier.label} className="flex justify-between text-sm">
                                            <span className="text-gray-400">{tier.label} × {tier.count}</span>
                                            <span className="text-gray-300 font-medium">{formatPrice(tier.subtotalCents)}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    );
};

// ---------- Page ----------

export default function ReferralPage() {
    return (
        <div className={`min-h-screen bg-black text-white ${caveat.variable}`}>
            <Navigation simple />
            <HeroSection />
            <TiersSection />
            <EarningsSimulatorSection />
        </div>
    );
}
