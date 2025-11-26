// app/api/protected/user/route.js
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getApiRequestTokens, getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { refreshCookiesWithIdToken } from 'next-firebase-auth-edge/next/cookies';

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
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
console.log(decodedToken)
    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: userData.name,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        emailVerified: decodedToken.email_verified,
        onboardingStep: userData.onboardingStep,
        plan: userData.plan,
        billingType: userData.billingType,
        credits: userData.credits,
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