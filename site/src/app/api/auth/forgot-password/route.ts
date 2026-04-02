import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request) {
    try {
        const { email } = await request.json();

        const link = await adminAuth.generatePasswordResetLink(email, {
            url: process.env.NEXT_PUBLIC_DOMAIN + "/reset-password",
            handleCodeInApp: false,
        });

        await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: { resetLink: link, email},
                type: "password-reset"
            })
        });

        return Response.json({ link }, { status: 200 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 400 });
    }
}
