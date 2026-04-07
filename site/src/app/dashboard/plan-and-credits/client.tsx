'use client'

import { useState, useEffect } from "react";
import { PlanSelector } from "@/components/PlanSelector";
import type { PlanInfo } from "@/components/PlanSelector";
import { CreditSelector } from "@/components/CreditSelector";
import type { CreditPackage } from "@/components/CreditSelector";
import { UnifiedCheckout } from "@/components/UnifiedCheckout";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics";

interface PlanAndCreditsClientProps {
    email: string;
}

export default function PlanAndCreditsClient({ email }: PlanAndCreditsClientProps) {
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [purchaseType, setPurchaseType] = useState<"plan" | "credits">("credits");
    const [itemId, setItemId] = useState<string>("");
    const [checkoutTitle, setCheckoutTitle] = useState<string>("");

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
        track({ name: "credits_package_select", params: { package_id: pkg.id, credits: pkg.credits, price_cents: pkg.price } });
        setPurchaseType("credits");
        setItemId(pkg.id);
        setCheckoutTitle(`Buy ${pkg.credits.toLocaleString()} Credits`);
        setCheckoutOpen(true);
    };

    return (
        <div className="space-y-12">
            {/* Plans Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Choose a Plan</h2>
                    <p className="text-gray-400">
                        One-time purchase — pay once, use until your company limit is reached.
                    </p>
                </div>
                <PlanSelector
                    onCtaClick={handlePlanSelect}
                    ctaLabel="Buy Plan"
                    excludeFree={true}
                />
            </section>

            <div className="border-t border-white/10" />

            {/* Credits Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Top Up Credits</h2>
                    <p className="text-gray-400">
                        Add credits to your account instantly. Credits are used to generate personalised emails.
                    </p>
                </div>
                <CreditSelector
                    onSelect={() => {}}
                    showBuyButton={true}
                    onBuyClick={handleCreditBuy}
                />
            </section>

            {/* Checkout Dialog */}
            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{checkoutTitle}</DialogTitle>
                    </DialogHeader>
                    {itemId && (
                        <UnifiedCheckout
                            purchaseType={purchaseType}
                            itemId={itemId}
                            email={email}
                            onSuccess={() => setCheckoutOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
