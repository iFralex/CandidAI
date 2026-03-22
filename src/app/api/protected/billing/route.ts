import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from 'next-firebase-auth-edge';
import { clientConfig, serverConfig } from '@/config';
import { adminDb } from '@/lib/firebase-admin';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request: NextRequest) {
  // Test bypass
  if (process.env.NODE_ENV !== 'production') {
    const mock = getTestMock('/api/protected/billing');
    if (mock) return NextResponse.json(mock);
    if (request.cookies.get('__playwright_user__')?.value) {
      return NextResponse.json({ success: true, payments: [] });
    }
  }

  try {
    const tokens = await getTokens(request.cookies, {
      apiKey: clientConfig.apiKey,
      cookieName: serverConfig.cookieName,
      cookieSignatureKeys: serverConfig.cookieSignatureKeys,
      serviceAccount: serverConfig.serviceAccount,
    });

    const uid = tokens?.decodedToken?.uid;
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paymentsSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('payments')
      .orderBy('createdAt', 'desc')
      .get();

    const payments = paymentsSnap.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate
        ? d.createdAt.toDate().toISOString()
        : d.createdAt?.seconds
        ? new Date(d.createdAt.seconds * 1000).toISOString()
        : null;
      return {
        id: doc.id,
        createdAt,
        description: d.description ?? d.item ?? null,
        amount: d.amount ?? null,
        currency: d.currency ?? 'usd',
        status: d.status ?? null,
      };
    });

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
