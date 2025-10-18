// app/api/protected/user/result/[resultId]/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';

export async function GET(request, { params }) {
    try {
        // Estrai l'ID dinamico del risultato dall'URL
        const { resultId } = params;

        // Autentica l'utente tramite cookie Firebase
        const tokens = await getTokens(request.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });

        const decodedToken = tokens?.decodedToken;
        if (!decodedToken) {
            return NextResponse.json(
                { error: 'Non autorizzato' },
                { status: 401 }
            );
        }

        const userId = decodedToken.uid;

        // Percorso Firestore:
        // users/{userId}/data/results/{resultId}/details
        const detailsRef = adminDb
            .collection('users')
            .doc(userId)
            .collection('data')
            .doc('results')
            .collection(resultId)
            .doc('details');

        const detailsDoc = await detailsRef.get();

        if (!detailsDoc.exists) {
            return NextResponse.json({
                success: true,
                data: {}
            });
        }

        const detailsData = detailsDoc.data();

        return NextResponse.json({
            success: true,
            data: detailsData
        });

    } catch (error) {
        console.error('Errore API protetta:', error);
        return NextResponse.json(
            { error: 'Non autorizzato' },
            { status: 401 }
        );
    }
}
