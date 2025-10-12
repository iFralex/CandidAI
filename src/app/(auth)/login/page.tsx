import { LoginForm } from "@/components/login-form"
import { Review, reviews } from "@/components/reviews";
import { headers } from "next/headers";

export default async function RegisterPage() {
  const email = (await headers()).get("x-email")
  
  return (
    <LoginForm />
  )
}
