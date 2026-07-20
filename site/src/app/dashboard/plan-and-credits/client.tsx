'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowDown, Building2, Check, Coins, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
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
        router.refresh();
    };

    return (
        <div className="space-y-10">
            <Card className="relative overflow-hidden border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-purple-500/[0.07] to-transparent p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <Badge className="border-violet-300/20 bg-violet-400/10 text-violet-200"><Sparkles className="mr-1 h-3.5 w-3.5" />Plan & capacity</Badge>
                        <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Give your next applications more reach.</h1>
                        <p className="mt-3 max-w-2xl leading-7 text-gray-300">Add company capacity with a plan, or top up credits for extra research, regeneration, and personalization. Every purchase is one-time.</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a href="#plans"><Button variant="primary" icon={<Building2 className="h-4 w-4" />}>Compare plans</Button></a>
                            <a href="#credits"><Button variant="secondary" icon={<Coins className="h-4 w-4" />}>Top up credits</Button></a>
                        </div>
                    </div>
                    <div className="grid min-w-[260px] gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Current plan</p><p className="mt-1 font-semibold text-white">{currentPlanName}</p></div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Companies remaining</p><p className="mt-1 font-semibold text-white">{companiesRemaining} <span className="font-normal text-gray-500">of {maxCompanies}</span></p></div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"><p className="text-xs text-gray-500">Credit balance</p><p className="mt-1 font-semibold text-white">{credits.toLocaleString()}</p></div>
                    </div>
                </div>
            </Card>

            <section id="plans" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Crown className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">01 · Company capacity</p><h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Choose the reach of your campaign.</h2><p className="mt-2 max-w-2xl text-gray-400">Each plan adds a new allocation of target companies. Any unused company capacity you already own carries over.</p></div></div>
                    <div className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" />One-time payment, no subscription</div>
                </div>
                <PlanSelector
                    onCtaClick={handlePlanSelect}
                    ctaLabel="Choose this plan"
                    excludeFree={true}
                />
            </section>

            <div className="flex items-center justify-center text-gray-600"><ArrowDown className="h-5 w-5" /></div>

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
                />
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-gray-500"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />Secure Stripe checkout</span><span>Credits are added immediately</span><span>Available across your campaigns</span></div>
            </section>

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-5 sm:max-w-5xl sm:p-7">
                    <DialogHeader className="pr-8 text-left">
                        <DialogTitle>{checkoutTitle}</DialogTitle>
                        <DialogDescription>Secure one-time payment. Your new capacity is added as soon as Stripe confirms the purchase.</DialogDescription>
                    </DialogHeader>
                    <Separator />
                    {itemId && (
                        <UnifiedCheckout
                            purchaseType={purchaseType}
                            itemId={itemId}
                            email={email}
                            onSuccess={handleSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
