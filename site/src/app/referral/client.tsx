"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Caveat } from "next/font/google";
import {
    Sparkles, TrendingUp, Zap, Rocket, Crown, ArrowRight, Check, X,
    QrCode, Gift, Shirt, Award, Sticker, StickyNote, GraduationCap,
    Presentation, Mail, Pin, Sparkle, Archive, Share2, Users, Trophy,
    Newspaper, Stamp, BookOpen, Megaphone, FileX, Scissors, ChevronDown,
} from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Footer } from "@/components/landing";
import Link from "next/link";
import Image from "next/image";
import { track } from "@/lib/analytics";
import { plansInfo } from "@/config";
import { computePriceInCents, formatPrice } from "@/lib/utils";
import { computeReferralEarnings } from "@/lib/referral";
import { ReferralDashboardPreview } from "@/components/referral-dashboard-preview";

const caveat = Caveat({
    variable: "--font-caveat",
    subsets: ["latin"],
    weight: ["500", "600", "700"],
});

// ---------- Data ----------

const COMMISSION_TIERS = [
    { range: "Purchases 1–5", rate: "5%", note: "Your first five qualifying purchases", icon: TrendingUp },
    { range: "Purchases 6–15", rate: "10%", note: "Ten more at double the rate", icon: Zap },
    { range: "Purchases 16–30", rate: "15%", note: "Fifteen more at the next tier", icon: Rocket },
    { range: "Purchases 31+", rate: "20%", note: "Every later qualifying purchase while you remain eligible", icon: Crown },
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
                    <span className="block text-[clamp(2.5rem,5.5vw,4.5rem)]">Get Paid to Help Job Seekers</span>
                    <span className="block text-[clamp(2.5rem,5.5vw,4.5rem)] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                        Escape the Application Pile
                    </span>
                </h1>

                <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                    Help job seekers reach recruiters directly and earn{" "}
                    <span className="text-violet-300 font-medium">up to 20% on qualifying purchases</span>. Approved
                    ambassadors can request a full guerrilla-marketing kit — materials are included, while shipping is charged separately.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        href="/contact?mode=referral"
                        className={buttonVariants({ size: "lg" })}
                        onClick={() => {
                            track({ name: "referral_cta_click", params: { button_label: "Apply to become an Ambassador", section: "hero" } });
                        }}
                    >
                        Apply to become an Ambassador
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => document.getElementById("tiers")?.scrollIntoView({ behavior: "smooth" })}
                    >
                        Explore the program
                    </Button>
                </div>
            </div>
        </section>
    );
};

const TiersSection = () => {
    const renderTier = (tier: typeof COMMISSION_TIERS[number], index: number) => {
        const Icon = tier.icon;
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-full"
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
    };

    return (
        <section id="tiers" className="relative px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 text-center md:mb-16">
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        The More You Sell, the More You Keep
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-400 md:text-xl">
                        Commission tiers stack automatically. No renegotiating, no resetting — every qualifying purchase moves you forward.
                    </p>
                </div>

                <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="md:hidden">
                    <CarouselContent className="-ml-3">
                        {COMMISSION_TIERS.map((tier, index) => (
                            <CarouselItem key={tier.range} className="basis-[86%] pl-3 sm:basis-[48%]">
                                {renderTier(tier, index)}
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <p className="mt-4 text-center text-xs text-gray-600">Swipe to compare tiers</p>
                </Carousel>
                <div className="hidden gap-6 md:grid md:grid-cols-4">
                    {COMMISSION_TIERS.map((tier, index) => (
                        <div key={tier.range}>{renderTier(tier, index)}</div>
                    ))}
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
    const simulatorSectionRef = useRef<HTMLElement>(null);

    const priceCents = computePriceInCents("plan", planId);
    const result = useMemo(() => computeReferralEarnings(count, priceCents), [count, priceCents]);

    useEffect(() => {
        const el = simulatorSectionRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    track({ name: "referral_simulator_section_view", params: {} });
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={simulatorSectionRef} className="relative bg-black px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-10 text-center md:mb-16">
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        Run the Numbers Yourself
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-400 md:text-xl">
                        Pick a plan, pick a volume, see what it's worth.
                    </p>
                </div>

                <Card className="p-5 sm:p-8 md:p-10" gradient>
                    <div className="grid md:grid-cols-2 gap-8 md:gap-10">
                        <div>
                            <label className="text-sm text-gray-400 uppercase tracking-widest mb-3 block">
                                Plan purchased
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                                {paidPlans.map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => {
                                            if (planId !== plan.id) {
                                                track({ name: "referral_simulator_plan_select", params: { plan_id: plan.id, plan_name: plan.name, plan_price: plan.price } });
                                            }
                                            setPlanId(plan.id);
                                        }}
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
                                Qualifying purchases through your link
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
                                        onClick={() => {
                                            if (count !== preset) {
                                                track({ name: "referral_simulator_preset_select", params: { count: preset } });
                                            }
                                            setCount(preset);
                                        }}
                                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                                    >
                                        {preset} purchases
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
                            <p className="mt-5 text-xs leading-relaxed text-gray-500">
                                Estimate based on the current full list price of the selected plan. It does not account for discounts, refunds, taxes, chargebacks, or future price changes.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    );
};

const DashboardPreviewSection = () => {
    const steps = [
        { number: "01", title: "Apply", text: "Tell us where and how you would activate the campaign." },
        { number: "02", title: "Get approved", text: "Receive the current terms, your personal link, and dashboard access." },
        { number: "03", title: "Launch", text: "Share online or use the physical kit in approved locations." },
        { number: "04", title: "Track and earn", text: "Follow scans, signups, qualifying purchases, and commissions in real time." },
    ];

    return (
        <section className="relative overflow-hidden px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10 md:mb-14">
                    <Badge className="mb-5">Real-time ambassador dashboard</Badge>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Know exactly what your work generates.
                    </h2>
                    <p className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto">
                        See the complete path from QR scan to qualifying purchase, follow your tier progress, and keep your referral link ready to share.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-violet-500/25 bg-violet-500/5 p-2 sm:p-3 shadow-2xl shadow-violet-950/30">
                    <ReferralDashboardPreview />
                </div>
                <p className="mt-3 text-center text-xs text-gray-600 lg:hidden">Swipe horizontally to explore the dashboard.</p>

                <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="mt-8 sm:hidden">
                    <CarouselContent className="-ml-3">
                        {steps.map((step) => (
                            <CarouselItem key={step.number} className="basis-[84%] pl-3">
                                <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-5">
                                    <span className="text-xs font-bold tracking-widest text-violet-400">{step.number}</span>
                                    <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.text}</p>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                </Carousel>
                <div className="mt-12 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((step) => (
                        <div key={step.number} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                            <span className="text-xs font-bold tracking-widest text-violet-400">{step.number}</span>
                            <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const KIT_PHYSICAL_ITEMS = [
    { icon: Sticker, name: "50 stickers, 5 designs", description: "Bulletin-board size and laptop/bottle size, each with a tracked QR.", preview: "/images/referral/materials/sticker-01.svg" },
    { icon: QrCode, name: "50 personal QR cards", description: "Your link, pocket-sized. Hand them out or leave them behind.", preview: "/images/referral/materials/card-qr-front.svg" },
    { icon: Newspaper, name: "15 fake job postings", description: "Pre-cut tear-off tabs, straight out of a '90s bulletin board.", preview: "/images/referral/materials/flyer-tear-tabs.svg" },
    { icon: Mail, name: "30 rejection letters", description: "Fake, but painfully realistic — plus a few 'special' ones.", preview: "/images/referral/materials/rejection-letter-01.svg" },
    { icon: StickyNote, name: "Post-it pad", description: "Targeted messages, made to be left where no one expects them.", preview: "/images/referral/materials/post-it.svg" },
    { icon: GraduationCap, name: "10 'Ignored Applications' diplomas", description: "Rolled with ribbon, indistinguishable from the real thing.", preview: "/images/referral/materials/diploma.svg" },
    { icon: Presentation, name: "Foldable A3 poster", description: "Built for career days.", preview: "/images/referral/materials/career-day-sign.svg" },
    { icon: Pin, name: "Removable tape + adhesive putty", description: "Hang anything, anywhere, without leaving a trace.", preview: "/images/referral/materials/removable-tape-putty.webp" },
    { icon: Sparkle, name: "1 rare holographic sticker", description: "Only for those who actually open the kit.", preview: "/images/referral/materials/sticker-holo.svg" },
];

const KIT_DIGITAL_ITEMS = [
    { icon: Crown, name: "Pro plan benefit", description: "Available to eligible active ambassadors under the current program terms." },
    { icon: Archive, name: "Print-ready archive", description: "Every material, reprintable on your own — including the large-format stunt files." },
    { icon: Share2, name: "Social assets", description: "Story templates, memes, and copy ready to post." },
    { icon: Users, name: "Private community", description: "The ambassador-only channel." },
];

const KitItemCard = ({ item, index = 0 }: { item: typeof KIT_PHYSICAL_ITEMS[number]; index?: number }) => {
    const Icon = item.icon;
    const isRare = item.name.includes("holographic");

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="h-full"
        >
            <Card className="p-4 sm:p-5 h-full relative" gradient={isRare}>
                {item.name === "30 rejection letters" ? (
                    <div className="relative mb-5 h-44 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3">
                        <a href="/images/referral/materials/rejection-letter-01.svg" target="_blank" rel="noopener noreferrer" className="absolute inset-y-3 left-2 z-10 w-[68%] -rotate-3 overflow-hidden rounded-md border border-white/15 bg-transparent p-1 shadow-lg transition-transform duration-300 hover:z-30 hover:rotate-0 hover:scale-[1.03]" aria-label="Open a full-size rejection letter">
                            <img src="/images/referral/materials/rejection-letter-01.svg" alt="Rejection letter" loading="lazy" className="h-full w-full object-contain" />
                        </a>
                        <a href="/images/referral/materials/letter-special.svg" target="_blank" rel="noopener noreferrer" className="absolute inset-y-3 right-2 z-20 w-[64%] rotate-3 overflow-hidden rounded-md border border-violet-300/30 bg-transparent p-1 shadow-xl transition-transform duration-300 hover:rotate-0 hover:scale-[1.03]" aria-label="Open the recruiter interview email">
                            <img src="/images/referral/materials/letter-special.svg" alt="Recruiter email inviting the candidate to an interview" loading="lazy" className="h-full w-full object-contain" />
                        </a>
                    </div>
                ) : item.preview && (
                    <a href={item.preview} target="_blank" rel="noopener noreferrer" className="group/preview mb-5 flex h-44 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3" aria-label={`Open a full-size preview of ${item.name}`}>
                        <img src={item.preview} alt="" loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover/preview:scale-[1.03]" />
                    </a>
                )}
                <Icon className="w-7 h-7 text-violet-400 mb-3" />
                <h3 className="text-white font-semibold mb-1">{item.name}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
                {isRare && (
                    <p className={`${caveat.className} text-violet-300 text-lg mt-3 -rotate-2`}>psst — this one's real 👀</p>
                )}
            </Card>
        </motion.div>
    );
};

const KitSection = () => {
    const [showAllItems, setShowAllItems] = useState(false);
    const visibleItems = showAllItems ? KIT_PHYSICAL_ITEMS : KIT_PHYSICAL_ITEMS.slice(0, 4);

    return (
        <section className="relative px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 text-center md:mb-16">
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        The Ambassador Kit
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-400 md:text-xl">
                        Everything you need to make noise on campus. Nine physical pieces, four digital perks.
                    </p>
                    <p className="mx-auto mt-5 flex max-w-xl items-start justify-center gap-2 text-sm leading-relaxed text-gray-500">
                        <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
                        <span>For approved ambassadors, kit availability and shipping cost are confirmed before ordering.</span>
                    </p>
                </div>

                <div className="mb-10 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-2xl shadow-violet-950/25">
                    <Image
                        src="/images/referral/ambassador-kit.webp"
                        alt="The complete CandidAI Ambassador Kit with QR cards, stickers, posters, rejection letters, diploma, and campaign materials"
                        width={1672}
                        height={941}
                        className="h-auto w-full object-cover"
                        sizes="(max-width: 768px) 100vw, 1152px"
                    />
                </div>

                <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="mb-8 sm:hidden">
                    <CarouselContent className="-ml-3">
                        {KIT_PHYSICAL_ITEMS.map((item, index) => (
                            <CarouselItem key={item.name} className="basis-[88%] pl-3">
                                <KitItemCard item={item} index={index} />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <p className="mt-4 text-center text-xs text-gray-600">Swipe to explore all 9 kit items</p>
                </Carousel>

                <div className={`mb-10 hidden gap-6 sm:grid sm:grid-cols-2 ${showAllItems ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
                    {visibleItems.map((item, index) => (
                        <KitItemCard key={item.name} item={item} index={index} />
                    ))}
                </div>

                {!showAllItems && (
                    <div className="mb-10 hidden text-center sm:block">
                        <Button variant="secondary" size="sm" onClick={() => setShowAllItems(true)} aria-expanded={showAllItems}>
                            See everything included
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}

                <Card className="p-5 sm:p-8" gradient>
                    <h3 className="text-xl font-bold text-white mb-2">Plus, unlocked digitally via a QR in the kit</h3>
                    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                        {KIT_DIGITAL_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.name}>
                                    <Icon className="w-6 h-6 text-violet-400 mb-2" />
                                    <div className="text-white font-medium text-sm mb-1">{item.name}</div>
                                    <div className="text-gray-500 text-xs">{item.description}</div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </section>
    );
};

const InlineApplyCTA = () => (
    <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 to-purple-500/5 p-6 text-center sm:p-8 md:flex-row md:text-left">
            <div>
                <h2 className="text-2xl font-bold text-white">Can you picture this campaign in your community?</h2>
                <p className="mt-2 text-sm text-gray-400">Apply now; you can finish exploring every campaign idea afterward.</p>
            </div>
            <Link href="/contact?mode=referral" className={buttonVariants({ size: "md", className: "shrink-0" })} onClick={() => track({ name: "referral_cta_click", params: { button_label: "Apply now", section: "mid_page" } })}>
                Apply now <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
        </div>
    </section>
);

const PLAYBOOK = [
    {
        icon: Sticker,
        title: "Sticker Bombing",
        tag: "Reliable",
        description: "Bulletin boards, study rooms, any free surface. Five designs — find out which one converts best on your campus.",
        preview: "/images/referral/materials/sticker-03.svg",
    },
    {
        icon: Newspaper,
        title: "The Fake Job Posting",
        tag: "Reliable",
        description: "Pin it up with tear-off tabs: \"Wanted: Junior Developer. Requirements: 5 years of experience for an entry-level role. Or just tear a tab.\" Every tab torn off is a potential signup.",
        preview: "/images/referral/materials/flyer-tear-tabs.svg",
    },
    {
        icon: Stamp,
        title: "The Rejection Wall",
        tag: "High impact",
        description: "Cover a board with dozens of identical rejection letters. In the middle, one that's different — a recruiter who actually replies. The contrast says everything.",
        preview: "/images/referral/materials/rejection-letter-02.svg",
    },
    {
        icon: BookOpen,
        title: "Post-its in the Right Books",
        tag: "Sneaky",
        description: "A post-it inside Cracking the Coding Interview or a finance textbook: whoever finds it is preparing for interviews that LinkedIn was never going to bring them.",
        preview: "/images/referral/materials/post-it-02.svg",
    },
    {
        icon: GraduationCap,
        title: "The 'Ignored Applications' Diploma",
        tag: "Perfect timing",
        description: "On graduation day, hand new graduates the diploma nobody wants — but everyone photographs. Timed to the exact day job-search anxiety kicks in.",
        preview: "/images/referral/materials/diploma.svg",
    },
    {
        icon: Megaphone,
        title: "Career Day Mission",
        tag: "Reliable",
        description: "The line to talk to the big-name booth lasts two hours. You, with a poster and a card: \"This line: 2 hours. A direct email to the right recruiter: 2 minutes.\"",
        preview: "/images/referral/materials/career-day-sign.svg",
    },
    {
        icon: FileX,
        title: "The CV Funeral",
        tag: "Advanced stunt",
        description: "A headstone, a wreath, a minute of silence for the CV sent through LinkedIn — opened by no one, remembered by no one. Build the scene with simple local props; larger stunts may qualify for pre-approved production support.",
        preview: null,
    },
];

const PlaybookSection = () => {
    const [selected, setSelected] = useState(0);
    const [showAllPlaybook, setShowAllPlaybook] = useState(false);
    const active = PLAYBOOK[selected];
    const ActiveIcon = active.icon;
    const visiblePlaybook = showAllPlaybook ? PLAYBOOK : PLAYBOOK.slice(0, 3);

    return (
        <section className="relative bg-black px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 text-center md:mb-16">
                    <p className={`${caveat.className} text-violet-400 text-2xl mb-2`}>the field manual</p>
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        7 Ways to Use the Kit
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-400 md:text-xl">
                        Campaign ideas ranging from simple campus activations to advanced stunts.
                    </p>
                </div>

                <div className="grid min-w-0 gap-8 lg:grid-cols-3">
                    <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="min-w-0 max-w-full overflow-hidden lg:hidden">
                        <CarouselContent className="-ml-2">
                            {PLAYBOOK.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <CarouselItem key={item.title} className="basis-auto pl-2">
                                        <button
                                            type="button"
                                            aria-pressed={selected === index}
                                            className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${selected === index ? "border-violet-500 bg-violet-500/20 text-white" : "border-white/10 bg-white/5 text-gray-400"}`}
                                            onClick={() => {
                                                if (selected !== index) track({ name: "referral_playbook_select", params: { title: item.title } });
                                                setSelected(index);
                                            }}
                                        >
                                            <Icon className="h-4 w-4 text-violet-400" />
                                            {index + 1}. {item.title}
                                        </button>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                    </Carousel>

                    <div className="hidden space-y-3 lg:col-span-1 lg:block">
                        {visiblePlaybook.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    type="button"
                                    key={item.title}
                                    aria-pressed={selected === index}
                                    className={`w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all duration-300 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                                        selected === index ? "ring-2 ring-violet-500 bg-white/10" : ""
                                    }`}
                                    onClick={() => {
                                        if (selected !== index) {
                                            track({ name: "referral_playbook_select", params: { title: item.title } });
                                        }
                                        setSelected(index);
                                    }}
                                >
                                    <span className="text-gray-600 font-bold text-sm w-5">{index + 1}</span>
                                    <Icon className="w-5 h-5 text-violet-400 flex-shrink-0" />
                                    <span className="text-white text-sm font-medium">{item.title}</span>
                                </button>
                            );
                        })}
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => { setShowAllPlaybook(value => !value); if (showAllPlaybook && selected > 2) setSelected(0); }} aria-expanded={showAllPlaybook}>
                            {showAllPlaybook ? "Show fewer ideas" : "See all 7 campaign ideas"}
                            <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAllPlaybook ? "rotate-180" : ""}`} />
                        </Button>
                    </div>

                    <div className="lg:col-span-2">
                        <Card className="p-5 sm:p-8 h-full">
                            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.72fr)] sm:items-start">
                                <div>
                                    <Badge
                                        variant={active.tag === "Advanced stunt" ? "destructive" : "secondary"}
                                        className="mb-4 w-fit whitespace-nowrap"
                                    >
                                        {active.tag}
                                    </Badge>
                                    <div className="mb-6 flex min-w-0 items-start gap-3">
                                        <div className="w-12 h-12 shrink-0 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                            <ActiveIcon className="w-6 h-6 text-violet-400" />
                                        </div>
                                        <h3 className="min-w-0 break-words text-2xl font-bold leading-tight text-white">{active.title}</h3>
                                    </div>
                                    <p className="text-gray-300 leading-relaxed text-lg">{active.description}</p>
                                </div>
                                {active.title === "The Rejection Wall" ? (
                                    <div className="relative h-64 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3">
                                        <a
                                            href="/images/referral/materials/rejection-letter-02.svg"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute inset-y-5 left-3 z-10 w-[68%] -rotate-3 transition-transform duration-300 hover:z-30 hover:rotate-0 hover:scale-[1.03]"
                                            aria-label="Open the rejection letter"
                                        >
                                            <img src="/images/referral/materials/rejection-letter-02.svg" alt="Rejection letter" loading="lazy" className="h-full w-full object-contain" />
                                        </a>
                                        <a
                                            href="/images/referral/materials/letter-special.svg"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute inset-y-5 right-3 z-20 w-[64%] rotate-3 transition-transform duration-300 hover:rotate-0 hover:scale-[1.03]"
                                            aria-label="Open the recruiter interview email"
                                        >
                                            <img src="/images/referral/materials/letter-special.svg" alt="Recruiter email inviting the candidate to an interview" loading="lazy" className="h-full w-full object-contain" />
                                        </a>
                                        <span className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/75 px-3 py-1 text-[11px] font-medium text-gray-300 backdrop-blur-sm">
                                            Rejection → interview
                                        </span>
                                    </div>
                                ) : active.preview ? (
                                    <a href={active.preview} target="_blank" rel="noopener noreferrer" className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3" aria-label={`Open the full-size ${active.title} material`}>
                                        <img src={active.preview} alt="" loading="lazy" className="h-full w-full object-contain transition-transform duration-300 hover:scale-[1.02]" />
                                    </a>
                                ) : (
                                    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
                                        <ActiveIcon className="mb-4 h-10 w-10 text-violet-400/70" />
                                        <p className="font-medium text-white">Build it your way</p>
                                        <p className="mt-2 max-w-48 text-sm leading-relaxed text-gray-500">An activation concept, not a pre-made print file.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
};

const MILESTONES = [
    {
        level: "Level 1",
        threshold: "15 qualifying purchases in a month",
        icon: Shirt,
        rewards: ["The official campaign t-shirt — the uniform of people who understand how the job market actually works"],
    },
    {
        level: "Level 2",
        threshold: "50 qualifying purchases in 3 months",
        icon: Award,
        rewards: [
            "Limited holographic sticker pack — not sold in any kit",
            "Enamel pin: \"Survived 400 rejections\"",
            "Your pick: tote bag, mug, or campaign socks",
            "+25,000 bonus credits on your account",
        ],
    },
    {
        level: "Level 3",
        threshold: "200 qualifying purchases in a year",
        icon: Crown,
        rewards: [
            "The official hoodie — reserved for people who go all in",
            "Free Ultra plan, all of CandidAI",
            "A 1:1 CV/LinkedIn review with the founder",
        ],
    },
];

const LEADERBOARD_REWARD = {
    title: "Top 3 of the Semester",
    rewards: [
        "A signed reference letter + \"Top Campus Ambassador\" LinkedIn badge — real, verifiable experience for your CV",
        "20% more on every commission earned in those 3 months",
        "Insider access: a direct call with the founder, a say in upcoming features, your name in the site credits",
    ],
};

const MilestonesSection = () => {
    const renderMilestone = (milestone: typeof MILESTONES[number]) => {
        const Icon = milestone.icon;
        return (
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="h-full">
                <Card className="p-6 md:p-8 h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-1">{milestone.level}</div>
                    <div className="text-white text-lg font-bold mb-4">{milestone.threshold}</div>
                    <ul className="space-y-2">
                        {milestone.rewards.map((reward) => (
                            <li key={reward} className="text-gray-400 text-sm flex gap-2">
                                <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                {reward}
                            </li>
                        ))}
                    </ul>
                </Card>
            </motion.div>
        );
    };

    return (
        <section className="relative px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 grid gap-4 sm:grid-cols-2 md:mb-16 md:gap-6">
                    <Card className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <QrCode className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-1">Your own QR, only yours</h3>
                            <p className="text-gray-400 text-sm">Every scan, signup, and qualifying purchase is tracked in real time from your ambassador dashboard.</p>
                        </div>
                    </Card>
                    <Card className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <Gift className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-1">Commissions, your way</h3>
                            <p className="text-gray-400 text-sm">Eligible commissions can be paid out or converted to CandidAI credits under the current payout terms.</p>
                        </div>
                    </Card>
                </div>

                <div className="mb-10 text-center md:mb-16">
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        Milestone Rewards
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-400 md:text-xl">
                        Commissions apply per qualifying purchase. These rewards stack on top for sustained volume.
                    </p>
                </div>

                <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="mb-8 md:hidden">
                    <CarouselContent className="-ml-3">
                        {MILESTONES.map((milestone) => (
                            <CarouselItem key={milestone.level} className="basis-[88%] pl-3">
                                {renderMilestone(milestone)}
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <p className="mt-4 text-center text-xs text-gray-600">Swipe to compare milestones</p>
                </Carousel>
                <div className="mb-8 hidden gap-8 md:grid md:grid-cols-3">
                    {MILESTONES.map((milestone) => (
                        <div key={milestone.level}>{renderMilestone(milestone)}</div>
                    ))}
                </div>

                <Card className="p-8 md:p-10" gradient>
                    <div className="flex items-center gap-3 mb-4">
                        <Trophy className="w-8 h-8 text-yellow-400" />
                        <h3 className="text-2xl font-bold text-white">{LEADERBOARD_REWARD.title}</h3>
                    </div>
                    <ul className="grid md:grid-cols-3 gap-4">
                        {LEADERBOARD_REWARD.rewards.map((reward) => (
                            <li key={reward} className="text-gray-300 text-sm flex gap-2">
                                <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                {reward}
                            </li>
                        ))}
                    </ul>
                </Card>

                <p className={`${caveat.className} text-gray-400 text-xl text-center mt-10 -rotate-1`}>
                    Reward availability and fulfilment details are confirmed when each milestone is validated.
                </p>
            </div>
        </section>
    );
};

const GROUND_RULES = [
    { ok: true, text: "Irony? Always welcome." },
    { ok: false, text: "Personal attacks — never. The target is the job market, not a person." },
    { ok: false, text: "Vandalism — never." },
    { ok: false, text: "Posting where it's explicitly forbidden — never." },
];

const FAQS = [
    {
        question: "How do I actually get paid?",
        answer: "Eligible commissions can be paid by an available payout method or converted to CandidAI credits. The applicable threshold, timing, supported methods, and rollover rules are confirmed in the program terms provided when your application is accepted.",
    },
    {
        question: "What counts as a referral?",
        answer: "A completed purchase made through your personal QR code or link — not a click, not a signup. Commission tiers are based on the number of purchases, applied progressively as you cross each threshold.",
    },
    {
        question: "When does my Ambassador Kit arrive?",
        answer: "Once your application is approved, we'll confirm kit availability, shipping cost, and the expected dispatch window before you order. Shipping varies by destination.",
    },
    {
        question: "How does the application process work?",
        answer: "There's no instant sign-up. You apply through the form, our team reviews it, and you'll hear back by email with the current program terms and next steps, including link activation and kit availability.",
    },
    {
        question: "How does the Pro plan benefit work?",
        answer: "It is an eligibility-based program benefit rather than a guaranteed lifetime plan. Its duration and the activity requirements are specified in the terms provided when your application is accepted.",
    },
];

const GroundRulesSection = () => {
    return (
        <section className="relative px-4 py-10 sm:px-6 md:py-16 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Card className="p-5 sm:p-8 md:p-10">
                    <h3 className="text-2xl font-bold text-white mb-2">Ground Rules</h3>
                    <p className="text-gray-400 mb-6">The kit includes a "where yes / where no" mini-guide. The short version:</p>
                    <ul className="space-y-2.5">
                        {GROUND_RULES.map((rule) => (
                            <li key={rule.text} className="flex items-start gap-3">
                                {rule.ok ? (
                                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                )}
                                <span className="text-gray-300">{rule.text}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </section>
    );
};

const ReferralFAQSection = () => {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <section className="relative px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-10 text-center md:mb-16">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent md:text-5xl">
                        Frequently Asked Questions
                    </h2>
                </div>

                <div className="space-y-4">
                    {FAQS.map((faq, index) => (
                        <Card key={faq.question} className="overflow-hidden" hover={false}>
                            <button
                                id={`referral-faq-button-${index}`}
                                aria-expanded={openFaq === index}
                                aria-controls={`referral-faq-panel-${index}`}
                                className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 sm:p-6"
                                onClick={() => {
                                    if (openFaq !== index) {
                                        track({ name: "referral_faq_open", params: { question: faq.question } });
                                    }
                                    setOpenFaq(openFaq === index ? null : index);
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                                    <ChevronDown
                                        className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${openFaq === index ? "rotate-180" : ""}`}
                                    />
                                </div>
                            </button>
                            {openFaq === index && (
                                <div id={`referral-faq-panel-${index}`} role="region" aria-labelledby={`referral-faq-button-${index}`} className="px-5 pb-5 sm:px-6 sm:pb-6">
                                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

const ApplyCTASection = () => {
    return (
        <section id="apply" className="relative px-4 py-14 sm:px-6 md:py-24 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
                <Card className="p-6 sm:p-12" gradient>
                    <h2 className="mb-4 text-3xl font-bold bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent md:mb-6 md:text-5xl">
                        Ready to Make Some Noise?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Tell us a bit about yourself and where you'd run the playbook. We review every application by hand.
                    </p>

                    <Link
                        href="/contact?mode=referral"
                        className={buttonVariants({ size: "lg", className: "w-full sm:w-auto sm:min-w-64 whitespace-normal text-center" })}
                        onClick={() => {
                            document.cookie = `defaultSubject=Referral Program; path=/; max-age=${60 * 60}`;
                            track({ name: "referral_cta_click", params: { button_label: "Apply to become an Ambassador", section: "bottom_cta" } });
                        }}
                    >
                        Apply to become an Ambassador
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>

                    <p className="text-gray-500 text-sm mt-6">
                        Applications are reviewed manually. Benefits, rewards, commissions, and fulfilment remain subject to eligibility, availability, and the terms shared upon acceptance.
                    </p>
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
            <DashboardPreviewSection />
            <KitSection />
            <InlineApplyCTA />
            <PlaybookSection />
            <MilestonesSection />
            <GroundRulesSection />
            <ReferralFAQSection />
            <ApplyCTASection />
            <Footer />
        </div>
    );
}
