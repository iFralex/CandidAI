// app/api/auth/logout/route.js
import { NextResponse } from 'next/server';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function POST() {
  try {
    // Effettua il logout da Firebase
    await signOut(auth);

    return NextResponse.json(
      { success: true, message: 'Logout effettuato con successo' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Errore durante il logout:', error);
    
    return NextResponse.json(
      { error: 'Errore durante il logout' },
      { status: 500 }
    );
  }
}