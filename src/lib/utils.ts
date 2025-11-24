import { clsx, type ClassValue } from "clsx"
import { cookies } from "next/headers";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function getReferralDiscount() {
  const ref = await(await cookies()).get('referral');
  let refDiscount = 0
  if (ref) refDiscount = 20
  return refDiscount
}