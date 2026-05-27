import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CREDIT_PACKAGES, plansInfo, referralCodes } from "@/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getReferralDiscount() {
  // CLIENT SIDE
  if (typeof document === "undefined") return 0;

  const cookieString = document.cookie
    .split("; ")
    .find((c) => c.startsWith("referral="));
  if (!cookieString) return 0;

  const ref = cookieString.split("=")[1];

  if (ref && referralCodes[ref]) return referralCodes[ref];

  return 0;
}

/**
 * Read the discount code stored in the cookie set by middleware.ts when the
 * user landed with ?discount=CODE. Returns the raw code string; callers must
 * resolve it to a {type, value} object via /api/discount/validate (client)
 * or validateDiscountCode (server-side) before computing prices.
 */
export function getDiscountCode(): string | null {
  if (typeof document === "undefined") return null;
  const cookieString = document.cookie.split("; ").find((c) => c.startsWith("discount="));
  if (!cookieString) return null;
  return decodeURIComponent(cookieString.split("=")[1]) || null;
}

export interface ResolvedDiscount {
  type: "percentage" | "fixed";
  value: number;
}

/**
 * Pure price math. The caller must already have resolved the discount
 * via validateDiscountCode (server) or /api/discount/validate (client) —
 * we no longer look up codes from an in-bundle map, since the codes
 * registry lives in Firestore and is private.
 *
 * Returns the discounted price in cents, with a 1-cent floor so we never
 * send Stripe a zero amount on percentage rounding.
 */
export function applyDiscount(priceInCents: number, discount: ResolvedDiscount | null | undefined): number {
  if (!discount) return priceInCents;
  if (discount.type === "fixed") return Math.max(1, Math.floor(discount.value));
  return Math.max(1, Math.round(priceInCents * (1 - discount.value / 100)));
}

export const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;

export const getPlanById = (id) => plansInfo.find((p) => p.id === id);

/** Base price (in cents) for a plan or credits package. Discounts are
 *  applied separately via applyDiscount(basePrice, resolvedDiscount). */
export const computePriceInCents = (purchaseType: 'plan' | 'credits', itemId: string): number => {
  if (purchaseType !== 'plan' && purchaseType !== 'credits') {
    throw new TypeError(`Invalid purchaseType: ${purchaseType}`);
  }
  if (purchaseType === 'credits') {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
    if (!pkg) throw new Error(`Unknown credit package: ${itemId}`);
    return pkg.price;
  }
  const plan = getPlanById(itemId);
  if (!plan) throw new Error(`Unknown plan: ${itemId}`);
  return Math.round(plan.price * 100);
};
