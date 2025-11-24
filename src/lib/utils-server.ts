import { cookies } from "next/headers";

export async function getReferralDiscount() {
  const ref = await(await cookies()).get('referral');
  let refDiscount = 0
  if (ref) refDiscount = 20
  return refDiscount
}