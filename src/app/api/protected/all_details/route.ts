// app/api/protected/user/company/details/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';

export async function POST(request) {
    try {
        // ✅ Estrai array di ID dalla richiesta
        const { companyIds } = await request.json();

        if (!Array.isArray(companyIds) || companyIds.length === 0) {
            return NextResponse.json(
                { error: 'companyIds deve essere un array non vuoto' },
                { status: 400 }
            );
        }

        // ✅ Autentica utente tramite cookie Firebase
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

        // ✅ Per ogni companyId recupera `id/details`
        const detailsArray = await Promise.all(
            companyIds.map(async (companyId) => {
                try {
                    console.log(companyId, userId)
                    const baseRef = adminDb
                        .collection('users')
                        .doc(userId)
                        .collection('data')
                        .doc('results')
                        .collection(companyId);

                    const detailsRef = baseRef.doc('details');
                    const unlockedRef = baseRef.doc('unlocked');

                    const [detailsDoc, unlocked] = await Promise.all([
                        detailsRef.get(),
                        unlockedRef.get()
                    ]);

                    if (!detailsDoc.exists) {
                        return { companyId, data: {} };
                    }

                    return { companyId, data: detailsDoc.data(), unlocked: unlocked.data() };
                } catch (err) {
                    console.error(`Errore con companyId ${companyId}:`, err);
                    return { companyId, data: {}, error: true };
                }
            })
        );

        return NextResponse.json({
            success: true,
            data: detailsArray,
        });

    } catch (error) {
        console.error('Errore API protetta:', error);
        return NextResponse.json(
            { error: 'Errore interno' },
            { status: 500 }
        );
    }
}
