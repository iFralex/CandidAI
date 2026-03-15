import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
    try {
        await requireAuth(req);
    } catch {
        return NextResponse.json(
            { error: "Non autorizzato" },
            { status: 401 }
        );
    }

    try {
        const body = await req.json();
        const ids = body?.ids;
        const userId = body?.userId;

        if (!userId) {
            return NextResponse.json(
                { error: "userId mancante nella richiesta." },
                { status: 400 }
            );
        }

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
