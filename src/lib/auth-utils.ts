// lib/auth-utils.js
'use client';

import { setAuthCookie, clearAuthCookies, getAuthCookie } from '../actions/cookie-utils';

// Funzione per registrare un nuovo utente
export const registerUser = async (userData) => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore durante la registrazione');
    }

    // Salva token e dati utente nei cookie
    if (data.token) {
      setAuthCookie(data.token, data.user);
    }

    return data;
  } catch (error) {
    console.error('Errore registrazione:', error);
    throw error;
  }
};

// Funzione per effettuare il login
export const loginUser = async (credentials) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore durante il login');
    }

    // Salva token e dati utente nei cookie
    if (data.token) {
      setAuthCookie(data.token, data.user);
    }

    return data;
  } catch (error) {
    console.error('Errore login:', error);
    throw error;
  }
};

// Funzione per effettuare il logout
export const logoutUser = async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore durante il logout');
    }

    // Rimuovi i cookie di autenticazione
    clearAuthCookies();

    return data;
  } catch (error) {
    console.error('Errore logout:', error);
    // Anche in caso di errore, pulisci i cookie locali
    clearAuthCookies();
    throw error;
  }
};

// Funzione per verificare se l'utente è autenticato
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return getAuthCookie() !== null;
};

// Funzione per ottenere il token di autenticazione
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  const authData = getAuthCookie();
  return authData?.token || null;
};

// Funzione per ottenere i dati utente dai cookie
export const getUserFromCookie = () => {
  if (typeof window === 'undefined') return null;
  const authData = getAuthCookie();
  return authData?.userData || null;
};

// Funzione per registrare utenti con Google (gestisce il salvataggio in Firestore)
export const handleGoogleAuth = async (user) => {
  try {
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // Se l'utente non esiste in Firestore, crealo
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        name: user.displayName || 'Google User',
        email: user.email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        provider: 'google'
      });
    } else {
      // Aggiorna l'ultimo login
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(userDocRef, {
        lastLogin: new Date().toISOString()
      });
    }
    
    return user;
  } catch (error) {
    console.error('Errore durante il salvataggio utente Google:', error);
    throw error;
  }
};