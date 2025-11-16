import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin"; // <-- tu hai già adminDb inizializzato

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const ids = body?.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "Campo 'ids' mancante o non valido." },
                { status: 400 }
            );
        }

        // 🔥 Timestamp server (Firestore Admin)
        const serverTimestamp = new Date();

        // ❗ Devi sapere lo userId
        // Option A: lo ricevi dalla richiesta (più facile)
        const userId = body.userId;
        if (!userId) {
            return NextResponse.json(
                { error: "userId mancante nella richiesta." },
                { status: 400 }
            );
        }

        const batch = adminDb.batch();

        for (const companyId of ids) {
            const resultsRef = adminDb.doc(`users/${userId}/data/results`);
            const emailsRef = adminDb.doc(`users/${userId}/data/emails`);
            const detailsRef = adminDb.doc(
                `users/${userId}/data/results/${companyId}/details`
            );

            batch.update(resultsRef, { [`${companyId}.email_sent`]: serverTimestamp });
            batch.update(emailsRef, { [`${companyId}.email_sent`]: serverTimestamp });
            batch.update(detailsRef, { "email.email_sent": serverTimestamp });
        }

        await batch.commit();

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Errore API sent_emails:", err);
        return NextResponse.json(
            { error: "Errore server interno." },
            { status: 500 }
        );
    }
}
