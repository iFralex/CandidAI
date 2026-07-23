'use client'

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Gift, Target, Rocket, Crown, Check, X, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plansInfo, planRank } from "@/config";
import { computePriceInCents, formatPrice } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Gift,
    Target,
    Rocket,
    Crown,
};

export interface PlanInfo {
    id: string;
    name: string;
    price: number;
    description: string;
    features: string[];
    highlight: string;
    icon: string;
    color: string;
    popular?: boolean;
}

export interface PlanSelectorProps {
    onSelect?: (plan: PlanInfo) => void;
    selectedPlanId?: string;
    /** If provided, clicking the CTA button calls this instead of onSelect */
    onCtaClick?: (plan: PlanInfo) => void;
    /** Label for the CTA button. Defaults to "Select Plan" */
    ctaLabel?: string;
    /** Whether to exclude the free_trial plan. Defaults to true */
    excludeFree?: boolean;
    /** On phones, keep the comparison compact with one swipeable card at a time. */
    mobileCarousel?: boolean;
    /** The plan the user already owns. Lower tiers become non-purchasable
     *  ("Included"); the current tier is labelled and offered as a top-up. */
    currentPlan?: string;
}

export function PlanSelector({
    onSelect,
    selectedPlanId,
    onCtaClick,
    ctaLabel = "Select Plan",
    excludeFree = true,
    mobileCarousel = false,
    currentPlan,
}: PlanSelectorProps) {
    const plans = excludeFree ? plansInfo.filter((p) => p.id !== "free_trial") : plansInfo;
    const currentRank = planRank(currentPlan);

    // On phones, start the carousel centered on the recommended (popular) plan.
    const carouselRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!mobileCarousel) return;
        const container = carouselRef.current;
        if (!container || window.matchMedia("(min-width: 768px)").matches) return;
        const popularIndex = plans.findIndex((p) => p.popular);
        if (popularIndex < 0) return;
        // Defer one frame so the carousel is laid out before we measure. Measuring
        // too early (container.clientWidth still 0) makes the centering offset
        // negative, which over-scrolls to the last card (Ultra) instead of Pro.
        const raf = requestAnimationFrame(() => {
            const card = container.children[popularIndex] as HTMLElement | undefined;
            if (!card || !container.clientWidth) return;
            const target = container.scrollLeft
                + card.getBoundingClientRect().left
                - container.getBoundingClientRect().left
                - (container.clientWidth - card.clientWidth) / 2;
            container.scrollTo({ left: Math.max(0, target), behavior: "auto" });
        });
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mobileCarousel]);

    // Build a unified feature list for comparison (same approach as landing.tsx)
    const splitFeature = (feature: string) => {
        const numMatch = feature.match(/(\d[\d.,]*)/);
        if (numMatch) {
            const num = numMatch[0];
            const base = feature.replace(num, "").replace(/\s+/g, " ").trim().toLowerCase();
            return { base, hasNumber: true };
        }
        return { base: feature.trim().toLowerCase(), hasNumber: false };
    };

    const allFeatures = Array.from(new Set(plans.flatMap((p) => p.features)));
    const groupsMap = allFeatures.reduce<Record<string, Set<string>>>((acc, feat) => {
        const { base } = splitFeature(feat);
        if (!acc[base]) acc[base] = new Set();
        acc[base].add(feat);
        return acc;
    }, {});

    const groupedFeatures = Object.entries(groupsMap).map(([base, variantsSet]) => ({
        base,
        variants: Array.from(variantsSet),
    }));

    const handlePlanClick = (plan: PlanInfo) => {
        onSelect?.(plan);
    };

    const handleCtaClick = (e: React.MouseEvent, plan: PlanInfo) => {
        e.stopPropagation();
        if (onCtaClick) {
            onCtaClick(plan);
        } else {
            onSelect?.(plan);
        }
    };

    return (
        <>
        <div ref={carouselRef} className={mobileCarousel ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0" : "grid gap-6 md:grid-cols-3"}>
            {plans.map((plan, index) => {
                const Icon = iconMap[plan.icon] || Target;
                const isSelected = selectedPlanId === plan.id;
                const amountCents = computePriceInCents("plan", plan.id);
                const rank = planRank(plan.id);
                const isOwnedLower = Boolean(currentPlan) && rank < currentRank;
                const isCurrent = Boolean(currentPlan) && rank === currentRank && currentRank > 0;

                return (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        onClick={() => { if (!isOwnedLower) handlePlanClick(plan as PlanInfo); }}
                        className={mobileCarousel
                            ? `w-[88%] shrink-0 snap-center first:ml-[6%] last:mr-[6%] md:ml-0 md:mr-0 md:w-auto md:shrink ${isOwnedLower ? "cursor-default" : "cursor-pointer"}`
                            : isOwnedLower ? "cursor-default" : "cursor-pointer"}
                    >
                        <Card
                            className={`flex flex-col p-6 relative h-full transition-all duration-200 ${
                                isOwnedLower
                                    ? "opacity-60"
                                    : isSelected
                                    ? "ring-2 ring-violet-500 bg-violet-500/10"
                                    : isCurrent
                                    ? "ring-2 ring-emerald-500/40"
                                    : plan.popular
                                    ? "ring-2 ring-violet-500/50"
                                    : ""
                            }`}
                        >
                            {(isOwnedLower || isCurrent || plan.popular) && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className={`text-white text-xs px-3 py-1 ${
                                        isOwnedLower ? "bg-emerald-600" : isCurrent ? "bg-emerald-500" : "bg-violet-500"
                                    }`}>
                                        {isOwnedLower ? "Included" : isCurrent ? "Your plan" : "Most Popular"}
                                    </Badge>
                                </div>
                            )}

                            <div className="text-center mb-4">
                                <div
                                    className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center mx-auto mb-3 text-white`}
                                >
                                    <Icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                                <p className="text-gray-400 text-sm mb-3">{plan.description}</p>
                                <div className="text-3xl font-bold text-white">
                                    {plan.price === 0 ? (
                                        <span className="text-green-400">Free</span>
                                    ) : (
                                        formatPrice(amountCents)
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">one-time purchase</div>
                            </div>

                            <ul className="space-y-2 mb-6 flex-1">
                                {groupedFeatures.map(({ base, variants }, fIndex) => {
                                    const includedVariant = plan.features.find(
                                        (f) => splitFeature(f).base === base
                                    );
                                    const included = Boolean(includedVariant);
                                    const displayText = includedVariant ?? variants[0].replace(/(\d[\d.,]*)/, "X");

                                    return (
                                        <li key={fIndex} className="flex items-start gap-2">
                                            {included ? (
                                                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-400" />
                                            ) : (
                                                <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-600 opacity-30" />
                                            )}
                                            <span
                                                className={`w-full text-left text-sm ${
                                                    included
                                                        ? "text-gray-300"
                                                        : "text-gray-600 line-through opacity-60"
                                                }`}
                                            >
                                                {displayText}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            {isOwnedLower ? (
                                <Button
                                    variant="secondary"
                                    className="w-full"
                                    disabled
                                    icon={<Check className="w-5 h-5" />}
                                >
                                    Included in your plan
                                </Button>
                            ) : (
                                <Button
                                    variant={isSelected ? "primary" : plan.popular ? "primary" : "secondary"}
                                    className="w-full"
                                    onClick={(e) => handleCtaClick(e, plan as PlanInfo)}
                                    icon={isSelected ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                >
                                    {isSelected ? "Selected" : isCurrent ? "Add more capacity" : ctaLabel}
                                </Button>
                            )}
                        </Card>
                    </motion.div>
                );
            })}
        </div>
        {mobileCarousel && <p className="mt-2 text-center text-xs text-gray-600 md:hidden">Swipe to compare Base, Pro, and Ultra</p>}
        </>
    );
}
