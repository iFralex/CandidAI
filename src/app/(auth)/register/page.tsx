import { RegisterForm } from "@/components/login-form"
import { cookies, headers } from "next/headers";

export default async function RegisterPage() {
  const email = (await cookies()).get("defaultEmail")?.value
  
  return (
    <RegisterForm defaultEmail={email}/>
  )
}
