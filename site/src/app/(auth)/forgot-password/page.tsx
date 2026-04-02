import { ForgotPasswordForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { cookies } from "next/headers";
import Link from "next/link";

const Page = async () => {
    const email = (await cookies()).get("defaultEmail")?.value

    return <ForgotPasswordForm defaultEmail={email} />
}

export default Page