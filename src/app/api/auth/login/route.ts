// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validazione input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password sono obbligatori' },
        { status: 400 }
      );
    }

    // Effettua il login con Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Aggiorna il timestamp dell'ultimo login in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      await updateDoc(userDocRef, {
        lastLogin: new Date().toISOString()
      });
    }

    // Ottieni il token ID per l'autenticazione
    const idToken = await user.getIdToken();

    // Restituisci i dati utente e il token
    return NextResponse.json(
      {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          emailVerified: user.emailVerified
        },
        token: idToken
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Errore durante il login:', error);

    // Gestisci errori specifici di Firebase
    let errorMessage = 'Errore durante il login';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Utente non trovato';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Password incorretta';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Indirizzo email non valido';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Account disabilitato';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Troppi tentativi falliti. Riprova più tardi';
        break;
      default:
        errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    );
  }
}