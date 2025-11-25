import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getReferralDiscountServer } from "./utils-server";
import { billingData, plansInfo, referralCodes } from "@/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getReferralDiscount() {
  // CLIENT SIDE
  if (!document) return
  
  const cookieString = document.cookie
    .split("; ")
    .find((c) => c.startsWith("referral="));
  console.log("Cookie String:", cookieString)
  if (!cookieString) return 0;

  const ref = cookieString.split("=")[1];

  if (ref && referralCodes[ref]) return referralCodes[ref];

  return 0;
}

export const formatPrice = (cents) => `€${(cents / 100).toFixed(2)}`;

export const getPlanById = (id) => plansInfo.find((p) => p.id === id) || plansInfo[1];

export const computePriceInCents = (planId, billingType, applyDiscounts = true) => {
  const plan = getPlanById(planId);
  const refDiscount = 20//getReferralDiscount();
  if (!plan) return 0;

  // ---------------------------
  // ⭐ Caso lifetime (one-time)
  // ---------------------------
  if (billingType === "lifetime") {
    const baseCents = Math.round(plan.pricesLifetime * 100);

    // Applica solo refDiscount se consentito
    const finalRefDiscount = applyDiscounts ? refDiscount || 0 : 0;

    return Math.round(baseCents * (1 - finalRefDiscount / 100));
  }

  // ----------------------------------------
  // ⭐ Caso normale (ricorrente)
  // ----------------------------------------
  const baseCents = Math.round(plan.price * 100);
  const option = billingData[billingType] || billingData.monthly;

  const months = option.activableTimes || 1;
  const discount = applyDiscounts ? option.discount || 0 : 0;
  const finalRefDiscount = applyDiscounts ? refDiscount || 0 : 0;

  return Math.round(
    baseCents *
    months *
    (1 - discount / 100) *
    (1 - finalRefDiscount / 100)
  );
};