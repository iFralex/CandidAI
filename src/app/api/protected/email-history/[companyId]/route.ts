import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
    if (process.env.NODE_ENV !== 'production') {
        const urlPath = new URL(request.url).pathname;
        const mock = getTestMock(urlPath);
        if (mock) return NextResponse.json(mock);
        if (request.cookies.get('__playwright_user__')?.value) {
            return NextResponse.json({ success: true, versions: [] });
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
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        decodedToken = tokens.decodedToken;
    } catch {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    try {
        const { companyId } = await params;
        const userId = decodedToken.uid;

        const historyDoc = await adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(companyId)
            .doc("email_history")
            .get();

        const versions = historyDoc.exists ? (historyDoc.data()?.versions ?? []) : [];

        return NextResponse.json({ success: true, versions });
    } catch (error) {
        console.error('Firestore error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
