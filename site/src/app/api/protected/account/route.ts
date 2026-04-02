// app/api/protected/user/route.js
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { doc, getDoc, updateDoc } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getApiRequestTokens, getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request) {
  // Test bypass
  if (process.env.NODE_ENV !== 'production') {
    const mock = getTestMock('/api/protected/account');
    if (mock) return NextResponse.json(mock);
    // Cookie bypass: test users don't have Firebase tokens, return minimal mock
    if (request.cookies.get('__playwright_user__')?.value) {
      return NextResponse.json({
        success: true,
        data: {
          profileSummary: {
            experience: [],
            education: [],
            skills: [],
            location: {}
          },
          queries: [],
          customizations: { instructions: null }
        }
      });
    }
  }

  try {
    const tokens = await getTokens(request.cookies, {
      apiKey: clientConfig.apiKey,
      cookieName: serverConfig.cookieName,
      cookieSignatureKeys: serverConfig.cookieSignatureKeys,
      serviceAccount: serverConfig.serviceAccount,
    });

    const decodedToken = tokens?.decodedToken

    // Ottieni i dati utente da Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).collection("data").doc("account").get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Information not found' },
        { status: 404 }
      );
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