import { adminAuth } from "@/lib/firebase-admin";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCheck, CheckCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { refreshCredentials } from "next-firebase-auth-edge/next/cookies";
import { cookies } from "next/headers";

// Helper che attende un certo numero di millisecondi
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RedirectAfterDelay = async ({ ms }) => {
    await wait(ms);
    redirect("/dashboard"); // redirect server-side
    return <></>
};

const Page = async ({ params }) => {
    // Aggiorna l'utente su Firebase Admin
    try {
        await adminAuth.updateUser((await params).id, {
            emailVerified: true
        })

        await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/refresh-user", {
            method: "POST",
            headers: {
                cookie: await cookies()
            }
        })
    } catch {
        redirect("/dashboard")
    }

    return (
        <div className="h-screen flex flex-col justify-center items-center text-white text-center px-6">
            <CheckCircle size={48} className="w-32 h-32 text-violet-600" color="violet" />
            <h1 className="text-5xl font-extrabold my-4">Email Verified!</h1>
            <p className="text-lg mb-8">
                Your email has been successfully verified. <br />
                You will be redirected to your dashboard shortly.
            </p>

            <Suspense fallback={<p className="text-white text-lg">Redirecting...</p>}>
                {/* Dopo 10 secondi, redirect a /dashboard */}
                <RedirectAfterDelay ms={5000} />
            </Suspense>
        </div>
    );
};

export default Page;
