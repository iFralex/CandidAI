import { LoginForm } from "@/components/login-form"
import { Review, reviews } from "@/components/reviews";
import { cookies, headers } from "next/headers";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const email = (await cookies()).get("defaultEmail")?.value
  const { next } = await searchParams

  return (
    <LoginForm defaultEmail={email} next={next} />
  )
}
