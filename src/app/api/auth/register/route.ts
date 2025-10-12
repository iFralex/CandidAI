// app/api/auth/register/route.js
import { NextResponse } from 'next/server';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    // Validazione input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password e nome sono obbligatori' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La password deve contenere almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Crea utente con Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Aggiorna il profilo utente con il nome
    await updateProfile(user, {
      displayName: name
    });

    // Salva informazioni aggiuntive in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });

    // Restituisci i dati utente (senza informazioni sensibili)
    return NextResponse.json(
      {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          name: name,
          emailVerified: user.emailVerified
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Errore durante la registrazione:', error);

    // Gestisci errori specifici di Firebase
    let errorMessage = 'Errore durante la registrazione';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Questo indirizzo email è già in uso';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Indirizzo email non valido';
        break;
      case 'auth/weak-password':
        errorMessage = 'La password è troppo debole';
        break;
      default:
        errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}