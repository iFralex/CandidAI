import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CREDIT_PACKAGES, plansInfo, referralCodes, discountCodes } from "@/config";

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

export function getDiscountCode(): string | null {
  if (typeof document === "undefined") return null;
  const cookieString = document.cookie.split("; ").find((c) => c.startsWith("discount="));
  if (!cookieString) return null;
  return decodeURIComponent(cookieString.split("=")[1]) || null;
}

export function applyDiscount(priceInCents: number, code: string): number {
  const discount = discountCodes[code];
  if (!discount) return priceInCents;
  if (discount.type === 'fixed') return discount.value;
  return Math.max(1, Math.round(priceInCents * (1 - discount.value / 100)));
}

export const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;

export const getPlanById = (id) => plansInfo.find((p) => p.id === id);

export const computePriceInCents = (purchaseType: 'plan' | 'credits', itemId: string, discountCode?: string | null): number => {
  if (purchaseType !== 'plan' && purchaseType !== 'credits') {
    throw new TypeError(`Invalid purchaseType: ${purchaseType}`);
  }

  let basePrice: number;

  if (purchaseType === 'credits') {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
    if (!pkg) throw new Error(`Unknown credit package: ${itemId}`);
    basePrice = pkg.price;
  } else {
    const plan = getPlanById(itemId);
    if (!plan) throw new Error(`Unknown plan: ${itemId}`);
    basePrice = Math.round(plan.price * 100);
  }

  return discountCode ? applyDiscount(basePrice, discountCode) : basePrice;
};