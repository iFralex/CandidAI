// app/api/protected/results/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request) {
    // Test bypass
    if (process.env.NODE_ENV !== 'production') {
        // Empty-results override takes highest priority (beats the shared mock store)
        // so parallel tests that need empty state don't get another test's mock data.
        if (request.cookies.get('__playwright_empty_results__')?.value) {
            return NextResponse.json({ success: true, data: {} });
        }
        // Per-test results data via cookie (isolated per browser context, beats shared mock store)
        const resultsCookie = request.cookies.get('__playwright_results__')?.value;
        if (resultsCookie) {
            try {
                const data = JSON.parse(Buffer.from(resultsCookie, 'base64').toString('utf-8'));
                return NextResponse.json(data);
            } catch (e) { /* fall through */ }
        }
        const mock = getTestMock('/api/protected/results');
        if (mock) return NextResponse.json(mock);
        // Fallback: if __playwright_user__ cookie is present, return empty results
        // so the dashboard SSR can render without a real Firebase session.
        if (request.cookies.get('__playwright_user__')?.value) {
            return NextResponse.json({ success: true, data: {} });
        }
    }

    let decodedToken;

    try {
        const tokens = await getTokens(request.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });

        if (!tokens?.decodedToken) {
            return NextResponse.json(
                { error: 'Non autorizzato' },
                { status: 401 }
            );
        }

        decodedToken = tokens.decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json(
            { error: 'Non autorizzato' },
            { status: 401 }
        );
    }

    try {
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
        console.error('Firestore error:', error);

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}