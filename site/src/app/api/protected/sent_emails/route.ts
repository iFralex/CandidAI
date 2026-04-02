import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";
import { getTestMock } from "@/app/api/test/set-mock/route";

export async function POST(req: NextRequest) {
    // Test bypass
    if (process.env.NODE_ENV !== 'production') {
        const mock = getTestMock('/api/protected/sent_emails');
        if (mock) return NextResponse.json(mock);
        if (req.cookies.get('__playwright_user__')?.value) {
            return NextResponse.json({ success: true });
        }
    }

    let userId: string;

    try {
        const tokens = await getTokens(req.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });

        if (!tokens?.decodedToken?.uid) {
            return NextResponse.json(
                { error: "Non autorizzato" },
                { status: 401 }
            );
        }

        userId = tokens.decodedToken.uid;
    } catch {
        return NextResponse.json(
            { error: "Non autorizzato" },
            { status: 401 }
        );
    }

    try {
        const body = await req.json();
        const ids = body?.ids;

        if (!Array.isArray(ids)) {
            return NextResponse.json(
                { error: "Campo 'ids' deve essere un array." },
                { status: 400 }
            );
        }

        if (ids.length === 0) {
            return NextResponse.json({ success: true });
        }

        const emailSentTimestamp = new Date().toISOString();
        const batch = adminDb.batch();

        for (const companyId of ids) {
            const resultsRef = adminDb.doc(`users/${userId}/data/results`);
            const emailsRef = adminDb.doc(`users/${userId}/data/emails`);
            const detailsRef = adminDb.doc(
                `users/${userId}/data/results/${companyId}/details`
            );

            batch.update(resultsRef, { [`${companyId}.email_sent`]: emailSentTimestamp });
            batch.update(emailsRef, { [`${companyId}.email_sent`]: emailSentTimestamp });
            batch.update(detailsRef, { "email.email_sent": emailSentTimestamp });
        }

        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Errore API sent_emails:", err);
        return NextResponse.json(
            { error: "Errore server interno." },
            { status: 500 }
        );
    }
}
