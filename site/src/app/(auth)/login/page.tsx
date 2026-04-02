import { LoginForm } from "@/components/login-form"
import { Review, reviews } from "@/components/reviews";
import { cookies, headers } from "next/headers";

export default async function RegisterPage() {
  const email = (await cookies()).get("defaultEmail")?.value
  
  return (
    <LoginForm defaultEmail={email} />
  )
}
