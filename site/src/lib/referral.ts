export interface ReferralTierBreakdown {
    label: string;
    rate: number;
    count: number;
    subtotalCents: number;
}

export interface ReferralEarnings {
    totalCents: number;
    breakdown: ReferralTierBreakdown[];
}

const REFERRAL_TIERS: { max: number; rate: number; label: string }[] = [
    { max: 5, rate: 0.05, label: "Purchases 1–5 (5%)" },
    { max: 15, rate: 0.10, label: "Purchases 6–15 (10%)" },
    { max: 30, rate: 0.15, label: "Purchases 16–30 (15%)" },
    { max: Infinity, rate: 0.20, label: "Purchases 31+ (20%)" },
];

/**
 * Progressive tier math: each tier only taxes the units that fall inside it,
 * mirroring how the ambassador's commission rate actually escalates sale by sale.
 */
export function computeReferralEarnings(purchaseCount: number, priceCents: number): ReferralEarnings {
    const safeCount = Math.max(0, Math.floor(purchaseCount));
    let previousMax = 0;
    let totalCents = 0;

    const breakdown: ReferralTierBreakdown[] = REFERRAL_TIERS.map((tier) => {
        const count = Math.max(0, Math.min(safeCount, tier.max) - previousMax);
        const subtotalCents = Math.round(count * priceCents * tier.rate);
        totalCents += subtotalCents;
        previousMax = tier.max;
        return { label: tier.label, rate: tier.rate, count, subtotalCents };
    });

    return { totalCents, breakdown };
}
