'use client'

import { motion } from "framer-motion";
import { Gift, Target, Rocket, Crown, Check, X, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plansInfo } from "@/config";
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
}

export function PlanSelector({
    onSelect,
    selectedPlanId,
    onCtaClick,
    ctaLabel = "Select Plan",
    excludeFree = true,
}: PlanSelectorProps) {
    const plans = excludeFree ? plansInfo.filter((p) => p.id !== "free_trial") : plansInfo;

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
        <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => {
                const Icon = iconMap[plan.icon] || Target;
                const isSelected = selectedPlanId === plan.id;
                const amountCents = computePriceInCents("plan", plan.id);

                return (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        onClick={() => handlePlanClick(plan as PlanInfo)}
                        className="cursor-pointer"
                    >
                        <Card
                            className={`flex flex-col p-6 relative h-full transition-all duration-200 ${
                                isSelected
                                    ? "ring-2 ring-violet-500 bg-violet-500/10"
                                    : plan.popular
                                    ? "ring-2 ring-violet-500/50"
                                    : ""
                            }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-violet-500 text-white text-xs px-3 py-1">
                                        Most Popular
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
                                                className={`text-sm ${
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

                            <Button
                                variant={isSelected ? "primary" : plan.popular ? "primary" : "secondary"}
                                className="w-full"
                                onClick={(e) => handleCtaClick(e, plan as PlanInfo)}
                                icon={isSelected ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            >
                                {isSelected ? "Selected" : ctaLabel}
                            </Button>
                        </Card>
                    </motion.div>
                );
            })}
        </div>
    );
}
