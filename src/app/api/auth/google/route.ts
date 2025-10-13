import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token mancante' }, { status: 400 });
    }

    // Verifica il token con Firebase Admin
    const decodedToken = await admin.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Registra nuovo utente
      await setDoc(userDocRef, {
        name: decodedToken.name || 'Google User',
        email: decodedToken.email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      });
    } else {
      // Aggiorna ultimo login
      await updateDoc(userDocRef, {
        lastLogin: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        uid,
        email: decodedToken.email,
        name: decodedToken.name || 'Google User',
      },
      token: idToken,
    }, { status: 200 });

  } catch (error) {
    console.error('Errore login Google:', error);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
