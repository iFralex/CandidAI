// app/api/protected/user/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';

export async function GET(request) {
    try {
        const tokens = await getTokens(request.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });

        const decodedToken = tokens?.decodedToken

        // Ottieni i dati utente da Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).collection("data").doc("results").get();

        if (!userDoc.exists) {
            return NextResponse.json({
                success: true,
                data: {}
            });
        }

        const userData = userDoc.data();

        return NextResponse.json({
            success: true,
            data: userData
        });

    } catch (error) {
        console.error('Errore API protetta:', error);

        return NextResponse.json(
            { error: 'Non autorizzato' },
            { status: 401 }
        );
    }
}