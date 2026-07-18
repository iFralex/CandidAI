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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/landing";
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
        <section ref={simulatorSectionRef} className="relative py-24 px-6 lg:px-8 bg-black">
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
                                        onClick={() => {
                                            if (count !== preset) {
                                                track({ name: "referral_simulator_preset_select", params: { count: preset } });
                                            }
                                            setCount(preset);
                                        }}
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

const KIT_PHYSICAL_ITEMS = [
    { icon: Sticker, name: "50 stickers, 5 designs", description: "Bulletin-board size and laptop/bottle size, each with a tracked QR." },
    { icon: QrCode, name: "50 personal QR cards", description: "Your link, pocket-sized. Hand them out or leave them behind." },
    { icon: Newspaper, name: "15 fake job postings", description: "Pre-cut tear-off tabs, straight out of a '90s bulletin board." },
    { icon: Mail, name: "30 rejection letters", description: "Fake, but painfully realistic — plus a few 'special' ones." },
    { icon: StickyNote, name: "Post-it pad", description: "Targeted messages, made to be left where no one expects them." },
    { icon: GraduationCap, name: "10 'Ignored Applications' diplomas", description: "Rolled with ribbon, indistinguishable from the real thing." },
    { icon: Presentation, name: "Foldable A3 poster", description: "Built for career days." },
    { icon: Pin, name: "Removable tape + adhesive putty", description: "Hang anything, anywhere, without leaving a trace." },
    { icon: Sparkle, name: "1 rare holographic sticker", description: "Only for those who actually open the kit." },
];

const KIT_DIGITAL_ITEMS = [
    { icon: Crown, name: "Free Pro plan", description: "For as long as you're an active ambassador." },
    { icon: Archive, name: "Print-ready archive", description: "Every material, reprintable on your own — including the large-format stunt files." },
    { icon: Share2, name: "Social assets", description: "Story templates, memes, and copy ready to post." },
    { icon: Users, name: "Private community", description: "The ambassador-only channel." },
];

const KitSection = () => {
    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-4">
                    <Badge className="mb-6">Free — you only pay shipping (calculated at checkout, by country)</Badge>
                </div>
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        The Ambassador Kit
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Everything you need to make noise on campus. Nine physical pieces, four digital perks.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-10">
                    {KIT_PHYSICAL_ITEMS.map((item, index) => {
                        const Icon = item.icon;
                        const isRare = item.name.includes("holographic");
                        return (
                            <motion.div
                                key={item.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                            >
                                <Card className="p-6 h-full relative" gradient={isRare}>
                                    <Icon className="w-7 h-7 text-violet-400 mb-3" />
                                    <h3 className="text-white font-semibold mb-1">{item.name}</h3>
                                    <p className="text-gray-400 text-sm">{item.description}</p>
                                    {isRare && (
                                        <p className={`${caveat.className} text-violet-300 text-lg mt-3 -rotate-2`}>
                                            psst — this one's real 👀
                                        </p>
                                    )}
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                <Card className="p-8" gradient>
                    <h3 className="text-xl font-bold text-white mb-2">Plus, unlocked digitally via a QR in the kit</h3>
                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mt-6">
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

const PLAYBOOK = [
    {
        icon: Sticker,
        title: "Sticker Bombing",
        tag: "Reliable",
        description: "Bulletin boards, study rooms, any free surface. Five designs — find out which one converts best on your campus.",
    },
    {
        icon: Newspaper,
        title: "The Fake Job Posting",
        tag: "Reliable",
        description: "Pin it up with tear-off tabs: \"Wanted: Junior Developer. Requirements: 5 years of experience for an entry-level role. Or just tear a tab.\" Every tab torn off is a potential signup.",
    },
    {
        icon: Stamp,
        title: "The Rejection Wall",
        tag: "High impact",
        description: "Cover a board with dozens of identical rejection letters. In the middle, one that's different — a recruiter who actually replies. The contrast says everything.",
    },
    {
        icon: BookOpen,
        title: "Post-its in the Right Books",
        tag: "Sneaky",
        description: "A post-it inside Cracking the Coding Interview or a finance textbook: whoever finds it is preparing for interviews that LinkedIn was never going to bring them.",
    },
    {
        icon: GraduationCap,
        title: "The 'Ignored Applications' Diploma",
        tag: "Perfect timing",
        description: "On graduation day, hand new graduates the diploma nobody wants — but everyone photographs. Timed to the exact day job-search anxiety kicks in.",
    },
    {
        icon: Megaphone,
        title: "Career Day Mission",
        tag: "Reliable",
        description: "The line to talk to the big-name booth lasts two hours. You, with a poster and a card: \"This line: 2 hours. A direct email to the right recruiter: 2 minutes.\"",
    },
    {
        icon: FileX,
        title: "The CV Funeral",
        tag: "Advanced stunt",
        description: "A headstone, a wreath, a minute of silence for the CV sent through LinkedIn — opened by no one, remembered by no one. Print files are in the digital kit; we cover printing costs if you document it on video.",
    },
];

const PlaybookSection = () => {
    const [selected, setSelected] = useState(0);
    const active = PLAYBOOK[selected];
    const ActiveIcon = active.icon;

    return (
        <section className="relative py-24 px-6 lg:px-8 bg-black">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className={`${caveat.className} text-violet-400 text-2xl mb-2`}>the field manual</p>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        7 Ways to Use the Kit
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Field-tested guerrilla moves, from "reliable" to "advanced stunt."
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-3">
                        {PLAYBOOK.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <Card
                                    key={item.title}
                                    hover={false}
                                    className={`p-4 cursor-pointer transition-all duration-300 flex items-center gap-3 ${
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
                                </Card>
                            );
                        })}
                    </div>

                    <div className="lg:col-span-2">
                        <Card className="p-8 h-full">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                        <ActiveIcon className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{active.title}</h3>
                                </div>
                                <Badge variant={active.tag === "Advanced stunt" ? "destructive" : "secondary"}>{active.tag}</Badge>
                            </div>
                            <p className="text-gray-300 leading-relaxed text-lg">{active.description}</p>
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
        threshold: "15 referrals in a month",
        icon: Shirt,
        rewards: ["The official campaign t-shirt — the uniform of people who understand how the job market actually works"],
    },
    {
        level: "Level 2",
        threshold: "50 referrals in 3 months",
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
        threshold: "200 referrals in a year",
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
    return (
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="grid md:grid-cols-2 gap-6 mb-16">
                    <Card className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <QrCode className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-1">Your own QR, only yours</h3>
                            <p className="text-gray-400 text-sm">Every scan and every signup, tracked in real time from your ambassador dashboard.</p>
                        </div>
                    </Card>
                    <Card className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                            <Gift className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-1">Commissions, your way</h3>
                            <p className="text-gray-400 text-sm">Cash out or convert to CandidAI credits — you decide every month.</p>
                        </div>
                    </Card>
                </div>

                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Milestone Rewards
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Commissions pay per sale. These stack on top, for volume.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mb-8">
                    {MILESTONES.map((milestone) => {
                        const Icon = milestone.icon;
                        return (
                            <motion.div
                                key={milestone.level}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5 }}
                            >
                                <Card className="p-8 h-full">
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
                    })}
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
                    Every physical prize ships with a note written by hand. Yes, actually by hand.
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
        answer: "You choose, every payout cycle, whether to receive your commissions as a bank transfer/PayPal payment or as CandidAI credits. Commissions of €50 or more are paid out automatically every month; anything under that rolls over to the next month.",
    },
    {
        question: "What counts as a referral?",
        answer: "A completed purchase made through your personal QR code or link — not a click, not a signup. Commission tiers are based on the number of purchases, applied progressively as you cross each threshold.",
    },
    {
        question: "When does my Ambassador Kit arrive?",
        answer: "Once your application is approved, we ship it right away. You only pay for shipping, calculated at checkout based on your country — everything inside is free.",
    },
    {
        question: "How does the application process work?",
        answer: "There's no instant sign-up. You apply through the form, our team reviews it, and you'll hear back by email with next steps — your personal QR code and kit shipment.",
    },
    {
        question: "What does 'free Pro plan for the duration of the program' mean?",
        answer: "It's tied to your active participation, not a fixed end date — as long as you're an ambassador in good standing, your Pro plan stays free.",
    },
];

const GroundRulesSection = () => {
    return (
        <section className="relative py-16 px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Card className="p-8 md:p-10">
                    <h3 className="text-2xl font-bold text-white mb-2">Ground Rules</h3>
                    <p className="text-gray-400 mb-6">The kit includes a "where yes / where no" mini-guide. The short version:</p>
                    <ul className="space-y-3">
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
        <section className="relative py-24 px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        Frequently Asked Questions
                    </h2>
                </div>

                <div className="space-y-4">
                    {FAQS.map((faq, index) => (
                        <Card key={faq.question} className="overflow-hidden" hover={false}>
                            <button
                                className="w-full p-6 text-left focus:outline-none"
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
                                <div className="px-6 pb-6">
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
        <section id="apply" className="relative py-24 px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
                <Card className="p-12" gradient>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent">
                        Ready to Make Some Noise?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Tell us a bit about yourself and where you'd run the playbook. We review every application by hand.
                    </p>

                    <Link href="/contact">
                        <Button
                            size="lg"
                            className="min-w-64"
                            icon={<ArrowRight className="w-5 h-5" />}
                            onClick={() => {
                                document.cookie = `defaultSubject=Referral Program; path=/; max-age=${60 * 60}`;
                                track({ name: "referral_cta_click", params: { button_label: "Apply to become an Ambassador", section: "bottom_cta" } });
                            }}
                        >
                            Apply to become an Ambassador
                        </Button>
                    </Link>

                    <p className="text-gray-500 text-sm mt-6">
                        Applications are reviewed manually — we'll email you the next steps.
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
            <KitSection />
            <PlaybookSection />
            <MilestonesSection />
            <GroundRulesSection />
            <ReferralFAQSection />
            <ApplyCTASection />
            <Footer />
        </div>
    );
}
