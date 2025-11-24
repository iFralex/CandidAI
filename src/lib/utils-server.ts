import { referralCodes } from "@/config";
import { cookies } from "next/headers";

export async function getReferralDiscount() {
  const ref = await(await cookies()).get('referral')?.value;
  let refDiscount = 0
  if (ref && referralCodes[ref]) refDiscount = referralCodes[ref]
  return refDiscount
}