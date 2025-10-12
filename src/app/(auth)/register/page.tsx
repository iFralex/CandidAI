import { AuthSection, LoginForm, RegisterForm } from "@/components/login-form"
import { Review, reviews } from "@/components/reviews";
import { headers } from "next/headers";
import { AuthWrapper } from "@/components/authWrapper";

export default async function RegisterPage() {
  const email = (await headers()).get("x-email")
  
  return (
    <RegisterForm />
  )
}
