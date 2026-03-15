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

export const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;

export const getPlanById = (id) => plansInfo.find((p) => p.id === id);

export const computePriceInCents = (purchaseType: 'plan' | 'credits', itemId: string): number => {
  if (purchaseType !== 'plan' && purchaseType !== 'credits') {
    throw new TypeError(`Invalid purchaseType: ${purchaseType}`);
  }

  if (purchaseType === 'credits') {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
    if (!pkg) throw new Error(`Unknown credit package: ${itemId}`);
    return pkg.price;
  }

  // purchaseType === 'plan'
  const plan = getPlanById(itemId);
  if (!plan) throw new Error(`Unknown plan: ${itemId}`);
  return Math.round(plan.price * 100);
};