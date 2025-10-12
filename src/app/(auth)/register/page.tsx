import { RegisterForm } from "@/components/login-form"
import { headers } from "next/headers";

export default async function RegisterPage() {
  const email = (await headers()).get("x-email")
  
  return (
    <RegisterForm />
  )
}
