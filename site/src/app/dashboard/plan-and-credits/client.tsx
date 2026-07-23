'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PlanSelector } from "@/components/PlanSelector";
import type { PlanInfo } from "@/components/PlanSelector";
import { CreditSelector } from "@/components/CreditSelector";
import type { CreditPackage } from "@/components/CreditSelector";
import { UnifiedCheckout } from "@/components/UnifiedCheckout";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, ArrowRight, Building2, Check, Crown, Database, Mail, Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, Zap } from "lucide-react";
import { track } from "@/lib/analytics";
import { plansInfo } from "@/config";

interface PlanAndCreditsClientProps {
    email: string;
    plan?: string;
    credits?: number;
    maxCompanies?: number;
    companiesUsed?: number;
}

export default function PlanAndCreditsClient({ email, plan = "free_trial", credits = 0, maxCompanies = 0, companiesUsed = 0 }: PlanAndCreditsClientProps) {
    const router = useRouter();
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [purchaseType, setPurchaseType] = useState<"plan" | "credits">("credits");
    const [itemId, setItemId] = useState<string>("");
    const [checkoutTitle, setCheckoutTitle] = useState<string>("");
    const [selectedCreditId, setSelectedCreditId] = useState<string>();
    const currentPlanName = plansInfo.find(item => item.id === plan)?.name || "Free preview";
    const companiesRemaining = Math.max(0, maxCompanies - companiesUsed);

    useEffect(() => {
        track({ name: "plan_credits_page_view", params: {} });
    }, []);

    const handlePlanSelect = (plan: PlanInfo) => {
        track({ name: "plan_select", params: { plan_id: plan.id, plan_name: plan.name, plan_price: plan.price } });
        setPurchaseType("plan");
        setItemId(plan.id);
        setCheckoutTitle(`Purchase ${plan.name} Plan`);
        setCheckoutOpen(true);
    };

    const handleCreditBuy = (pkg: CreditPackage) => {
        setSelectedCreditId(pkg.id);
        track({ name: "credits_package_select", params: { package_id: pkg.id, credits: pkg.credits, price_cents: pkg.price } });
        setPurchaseType("credits");
        setItemId(pkg.id);
        setCheckoutTitle(`Buy ${pkg.credits.toLocaleString()} Credits`);
        setCheckoutOpen(true);
    };

    const handleSuccess = () => {
        setCheckoutOpen(false);
        // A plan purchase may have started the post-purchase onboarding
        // (first paid plan) or upgraded an existing paid plan. Either way the
        // dashboard is the right destination: it renders the post-purchase
        // setup when onboardingStep < 10, or the normal dashboard otherwise.
        // Credits just top up the balance, so refresh in place.
        if (purchaseType === "plan") {
            router.push("/dashboard");
        } else {
            router.refresh();
        }
    };

    return (
        <motion.div className="space-y-14" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
            <Card className="relative overflow-hidden border-violet-400/30 bg-gradient-to-br from-violet-500/20 via-purple-500/[0.08] to-transparent p-6 sm:p-10">
                <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="relative grid gap-10 lg:grid-cols-[1fr_300px] lg:items-center">
                    <div>
                        <Badge className="border-violet-300/20 bg-violet-400/10 text-violet-200"><Sparkles className="mr-1 h-3.5 w-3.5" />Your next campaign starts here</Badge>
                        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">Don&apos;t send more applications. Create better openings.</h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-300">Turn each target company into a researched recruiter, a verified way to reach them, and a message written for that exact opportunity.</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a href="#plans"><Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>Build my campaign</Button></a>
                            <a href="#how-it-scales"><Button variant="secondary">See what each level unlocks</Button></a>
                        </div>
                    </div>
                    <div className="grid min-w-[260px] gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Current plan</p><p className="mt-1 font-semibold text-white">{currentPlanName}</p></div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Companies remaining</p><p className="mt-1 font-semibold text-white">{companiesRemaining} <span className="font-normal text-gray-500">of {maxCompanies}</span></p></div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Credit balance</p><p className="mt-1 font-semibold text-white">{credits.toLocaleString()}</p></div>
                    </div>
                </div>
            </Card>

            <section className="space-y-7 text-center">
                <div><p className="text-sm uppercase tracking-[0.2em] text-violet-300">One system, every company</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold text-white sm:text-4xl">From a company name to a conversation worth starting.</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-gray-400">CandidAI does the work between finding an opportunity and reaching the person who can act on it.</p></div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                    {[{ icon: Building2, number: '01', title: 'Understand the company', text: 'Build the context needed to approach the right team with a relevant angle.' }, { icon: Search, number: '02', title: 'Find the strongest recruiter', text: 'Test increasingly broad strategies until a credible match emerges.' }, { icon: Mail, number: '03', title: 'Write for that connection', text: 'Generate a personal email grounded in your profile, the company, and the recruiter.' }].map((item, index) => <div className="contents" key={item.title}><Card hover={false} className="p-6 text-left"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><item.icon className="h-5 w-5" /></div><span className="text-xs text-gray-600">{item.number}</span></div><h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p></Card>{index < 2 && <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-violet-500/50 md:block" />}</div>)}
                </div>
            </section>

            <section id="how-it-scales" className="scroll-mt-24 space-y-7">
                <div className="text-center"><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Choose your advantage</p><h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">More than volume. More control at every level.</h2><p className="mx-auto mt-3 max-w-2xl text-gray-400">Start by scaling the result, then take control of who CandidAI finds, what it writes, and how deeply it understands each company.</p></div>
                <div className="space-y-4">
                    <Card hover={false} className="grid gap-6 border-blue-500/20 p-6 md:grid-cols-[210px_1fr] md:p-8"><div><Target className="h-7 w-7 text-blue-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-blue-300">Base · Scale</p><h3 className="mt-2 text-xl font-semibold text-white">Turn one result into a campaign.</h3></div><div className="grid gap-3 sm:grid-cols-2"><p className="flex gap-2 text-sm leading-6 text-gray-300"><Check className="mt-1 h-4 w-4 shrink-0 text-blue-400" />Research a relevant recruiter for every target company.</p><p className="flex gap-2 text-sm leading-6 text-gray-300"><Check className="mt-1 h-4 w-4 shrink-0 text-blue-400" />Receive the recruiter&apos;s verified email with every result.</p></div></Card>
                    <Card hover={false} className="grid gap-6 border-violet-500/30 bg-violet-500/[0.04] p-6 md:grid-cols-[210px_1fr] md:p-8"><div><SlidersHorizontal className="h-7 w-7 text-violet-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-violet-300">Pro · Direct</p><h3 className="mt-2 text-xl font-semibold text-white">Decide who we find and what we say.</h3></div><div className="grid gap-3 sm:grid-cols-2">{['Shape recruiter searches with up to 30 custom criteria.', 'Tell the AI what to emphasize, include, or avoid.', 'Automate personalized follow-up emails.', 'Use 1,000 credits for new research and regenerations.'].map(item => <p key={item} className="flex gap-2 text-sm leading-6 text-gray-300"><Check className="mt-1 h-4 w-4 shrink-0 text-violet-400" />{item}</p>)}</div></Card>
                    <Card hover={false} className="grid gap-6 border-amber-500/20 p-6 md:grid-cols-[210px_1fr] md:p-8"><div><Database className="h-7 w-7 text-amber-400" /><p className="mt-4 text-xs uppercase tracking-[0.18em] text-amber-300">Ultra · Orchestrate</p><h3 className="mt-2 text-xl font-semibold text-white">Validate and direct every company individually.</h3></div><div><p className="text-sm leading-7 text-gray-300">CandidAI retrieves a detailed company dossier first and lets you confirm the right company. Before generating, you can give each company its own recruiter strategy and custom writing instructions.</p><div className="mt-4 flex flex-wrap gap-2">{['Detailed company intelligence', 'Per-company recruiter strategy', 'Per-company custom instructions', 'AI company recommendations', 'Priority generation', '50 recruiter criteria'].map(item => <Badge key={item} variant="secondary" className="text-left text-gray-300"><Check className="mr-1.5 h-3.5 w-3.5 text-amber-400" />{item}</Badge>)}</div></div></Card>
                </div>
            </section>

            <section id="plans" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Crown className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Choose your campaign</p><h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">How far do you want to take your search?</h2><p className="mt-2 max-w-2xl text-gray-400">Choose scale, control, or complete company intelligence. Any unused company capacity you already own carries over.</p></div></div>
                    <div className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" />One-time payment, no subscription</div>
                </div>
                <PlanSelector
                    onCtaClick={handlePlanSelect}
                    ctaLabel="Choose this plan"
                    excludeFree={true}
                    currentPlan={plan}
                    mobileCarousel
                />
            </section>

            <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-gray-600"><span className="h-px w-12 bg-white/10" /><ArrowDown className="h-4 w-4" />Need more flexibility?<span className="h-px w-12 bg-white/10" /></div>

            <section id="credits" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><Zap className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-[0.18em] text-amber-300">02 · Flexible usage</p><h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Top up only when you need more.</h2><p className="mt-2 max-w-2xl text-gray-400">Credits power optional actions such as regenerating drafts, repeating recruiter searches, replacing companies, and additional research.</p></div></div>
                    <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3 text-sm"><span className="text-gray-500">Current balance</span><p className="mt-1 text-xl font-bold text-amber-200">{credits.toLocaleString()} credits</p></div>
                </div>
                <CreditSelector
                    onSelect={pkg => setSelectedCreditId(pkg.id)}
                    selectedId={selectedCreditId}
                    showBuyButton={true}
                    onBuyClick={handleCreditBuy}
                    mobileCarousel
                />
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-gray-500"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />Secure Stripe checkout</span><span>Credits are added immediately</span><span>Available across your campaigns</span></div>
            </section>

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl p-5 sm:max-w-5xl sm:p-7">
                    <DialogHeader className="pr-8 text-left">
                        <DialogTitle>{checkoutTitle}</DialogTitle>
                        <DialogDescription>Secure one-time payment. Your new capacity is added as soon as Stripe confirms the purchase.</DialogDescription>
                    </DialogHeader>
                    <Separator />
                    <ScrollArea className="no-scrollbar overflow-y-auto max-h-[calc(92vh-140px)]">
                        {itemId && (
                            <UnifiedCheckout
                                purchaseType={purchaseType}
                                itemId={itemId}
                                email={email}
                                onSuccess={handleSuccess}
                            />
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
