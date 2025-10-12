import Dashboard from "@/components/dashboard";
import { notFound, redirect } from "next/navigation";
import OnboardingPage from "../../components/onboardingServer";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";
import { cookies } from "next/headers";

const Page = async () => {
    const res = await fetch("http://localhost:3000/api/protected/user", {
        credentials: "include",
        cache: "no-cache",
        headers: {
            cookie: await cookies()
        }
    });

    if (!res.ok) {
        throw new Error(res.status);
    }
    const data = await res.json();

    if (!data.success)
        throw new Error(data.error)

    const user = data.user
    if (!user)
        redirect('/login')

    const currentStep = user.onboardingStep || 1

    if (currentStep < 10)
        return <OnboardingPage user={user} currentStep={currentStep} />

    return (
        <Dashboard userData={null} />
    )
}

export default Page;