import { adminAuth } from "@/lib/firebase-admin";

// Public, unauthenticated endpoint. Two rules keep it from becoming an account
// takeover / user-enumeration oracle:
//   1. NEVER return the reset link in the response — it is emailed only. The
//      previous `return { link }` handed a working reset link to any caller who
//      supplied a victim's email.
//   2. ALWAYS respond 200 with the same generic body, whether or not the email
//      exists, so the caller can't tell registered emails apart.
export async function POST(request) {
    let email;
    try {
        ({ email } = await request.json());
    } catch {
        return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
        return Response.json({ error: "email_required" }, { status: 400 });
    }

    try {
        const link = await adminAuth.generatePasswordResetLink(email, {
            url: process.env.NEXT_PUBLIC_DOMAIN + "/reset-password",
            handleCodeInApp: false,
        });

        await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Key": process.env.SESSION_API_KEY ?? "",
            },
            body: JSON.stringify({
                data: { resetLink: link, email },
                type: "password-reset",
            }),
        });
    } catch (error) {
        // Unknown email (auth/user-not-found) and any other failure fall through
        // to the same generic success response — no enumeration, no link leak.
        console.error("forgot-password:", error?.message ?? error);
    }

    return Response.json({ success: true }, { status: 200 });
}
