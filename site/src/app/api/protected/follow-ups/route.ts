import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "next-firebase-auth-edge";

import { clientConfig, serverConfig } from "@/config";
import { adminDb } from "@/lib/firebase-admin";

function isSent(timestamp: any) {
    return Number(timestamp?._seconds ?? timestamp?.seconds ?? 0) > 0
        || (typeof timestamp?.toMillis === "function" && timestamp.toMillis() > 0);
}

export async function GET(request: NextRequest) {
    let userId: string;
    try {
        const tokens = await getTokens(request.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });
        if (!tokens?.decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = tokens.decodedToken.uid;
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userRef = adminDb.collection("users").doc(userId);
        const resultsRef = userRef.collection("data").doc("results");
        const [userSnap, resultsSnap] = await Promise.all([userRef.get(), resultsRef.get()]);
        const rawResults = resultsSnap.data() || {};

        const campaigns = Object.entries(rawResults)
            .filter(([id, result]: [string, any]) => id !== "companies_to_confirm" && isSent(result?.email_sent))
            .map(([id, result]: [string, any]) => ({ id, result }));

        const campaignDocs = campaigns.length
            ? await adminDb.getAll(
                ...campaigns.flatMap(({ id }) => [
                    resultsRef.collection(id).doc("details"),
                    resultsRef.collection(id).doc("follow_up"),
                ]),
            )
            : [];

        const data = campaigns.map(({ id, result }, index) => {
            const detailsDoc = campaignDocs[index * 2];
            const followUpDoc = campaignDocs[index * 2 + 1];
            const details = detailsDoc?.exists ? detailsDoc.data() || {} : {};
            const recruiter = details.recruiter_summary || result.recruiter || {};
            const emailAddress = details.email?.email_address;

            return {
                id,
                company: details.company || result.company || null,
                recruiter: {
                    ...recruiter,
                    email: typeof emailAddress === "string" ? emailAddress : "",
                },
                email_sent: result.email_sent || details.email?.email_sent || null,
                follow_up_disposition: result.follow_up_disposition || null,
                follow_up_reminder_at: result.follow_up_reminder_at || null,
                follow_up: followUpDoc?.exists ? followUpDoc.data() : null,
            };
        });

        return NextResponse.json({
            success: true,
            plan: userSnap.data()?.plan || "free_trial",
            credits: Number(userSnap.data()?.credits || 0),
            email: userSnap.data()?.email || "",
            data,
        });
    } catch (error) {
        console.error("Follow-ups fetch failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
