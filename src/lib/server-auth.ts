// lib/server-auth.js
import { cookies } from 'next/headers';
import { admin } from './firebase-admin';

// Inizializza Firebase Admin (crea questo file se non esiste)
// lib/firebase-admin.js
/*
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const admin = getAuth();
*/

// Funzione per verificare il token lato server
export async function verifyAuthToken(token) {
  try {
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    
    const decodedToken = await admin.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// Funzione per ottenere l'utente autenticato lato server
export async function getServerUser() {
  const cookieStore = cookies();
  const token = cookieStore.get('authToken')?.value;

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken) {
      return null;
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };
  } catch (error) {
    // Token scaduto o non valido - elimina il cookie
    console.warn('Token expired or invalid, user needs to re-login');
    return null;
  }
}

// Funzione per proteggere le API routes
export async function requireAuth(request) {
  const token = request.headers.get('authToken');
  
  if (!token) {
    throw new Error('No authentication token provided');
  }

  if (!token) {
    throw new Error('No authentication token provided');
  }

  const decodedToken = await verifyAuthToken(token);
  
  if (!decodedToken) {
    throw new Error('Invalid authentication token');
  }

  return decodedToken;
}