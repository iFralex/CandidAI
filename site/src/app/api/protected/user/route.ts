// app/api/protected/user/route.js
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getApiRequestTokens, getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { refreshCookiesWithIdToken } from 'next-firebase-auth-edge/next/cookies';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request) {
  // Test bypass for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const testUserCookie = request.cookies.get('__playwright_user__')?.value;
    if (testUserCookie) {
      try {
        const cookieUser = JSON.parse(Buffer.from(testUserCookie, 'base64').toString('utf-8'));
        // Check server-side mock store for a step-advanced version of this user.
        // setTestMock is used by server components that can't set cookies (e.g. AdvancedFiltersServer).
        // Only use the mock if it's for the same user AND its step is >= the cookie step
        // (prevents stale mocks from prior tests from overriding fresher cookie state).
        const mock = getTestMock('/api/protected/user') as { user?: { uid?: string; onboardingStep?: number } } | null;
        if (
          mock?.user?.uid === cookieUser.uid &&
          (mock.user.onboardingStep ?? 0) >= (cookieUser.onboardingStep ?? 0)
        ) {
          return NextResponse.json(mock);
        }
        return NextResponse.json({ success: true, user: cookieUser });
      } catch (e) {
        // Fall through to normal auth
      }
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
    const userId = decodedToken.uid;
    const [userDoc, resultsDoc] = await Promise.all([
      adminDb.collection('users').doc(userId).get(),
      adminDb.collection('users').doc(userId).collection('data').doc('results').get(),
    ]);

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Count companies that have been processed (have a company entry in results)
    const resultsData = resultsDoc.exists ? (resultsDoc.data() ?? {}) : {};
    const companiesUsed = Object.entries(resultsData).filter(
      ([k, v]: any) => k !== 'companies_to_confirm' && typeof v === 'object' && v?.company
    ).length;

    // maxCompanies stored in Firestore accumulates across plan re-purchases;
    // fall back to the plan config for users who haven't gone through a paid purchase.
    const { plansData } = await import('@/config');
    const plan: string = userData.plan || 'free_trial';
    const maxCompanies: number =
      userData.maxCompanies ??
      (plansData as any)[plan]?.maxCompanies ??
      1;

    return NextResponse.json({
      success: true,
      user: {
        uid: userId,
        email: decodedToken.email,
        name: userData.name,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        emailVerified: decodedToken.email_verified,
        onboardingStep: userData.onboardingStep,
        plan: userData.plan,
        billingType: userData.billingType,
        credits: userData.credits,
        maxCompanies,
        companiesUsed,
        picture: decodedToken.picture,
      }
    });

  } catch (error) {
    console.error('Errore API protetta:', error);

    return NextResponse.json(
      { error: 'Non autorizzato' },
      { status: 401 }
    );
  }
}

export async function PUT(request) {
  try {
    // Verifica l'autenticazione
    const decodedToken = await requireAuth(request);

    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Il nome è obbligatorio' },
        { status: 400 }
      );
    }

    // Aggiorna i dati utente in Firestore
    const userDocRef = await adminDb.collection('users').doc(decodedToken.uid)
    await userDocRef.update({
      name: name.trim(),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Profilo aggiornato con successo'
    });

  } catch (error) {
    console.error('Errore aggiornamento profilo:', error);

    if (error.message === 'Non autorizzato' || error.message === 'No authentication token provided' || error.message === 'Invalid authentication token') {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}