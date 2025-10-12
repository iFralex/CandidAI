// contexts/AuthContext.js
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAuthCookie, setAuthCookie, clearAuthCookies } from '@/actions/cookie-utils';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere utilizzato all\'interno di AuthProvider');
  }
  
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla se c'è un utente salvato nei cookie al caricamento
    const checkCookieAuth = async () => {
      const cookieAuth = getAuthCookie();
      if (cookieAuth) {
        setUser(cookieAuth.userData);
      }
      setLoading(false);
    };

    checkCookieAuth();

    // Ascolta i cambiamenti di stato di Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Utente autenticato - ottieni il token e salvalo nei cookie
        try {
          const token = await firebaseUser.getIdToken();
          const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email,
            emailVerified: firebaseUser.emailVerified
          };
          
          setAuthCookie(token, userData);
          setUser(userData);
        } catch (error) {
          console.error('Errore nell\'ottenere il token:', error);
          clearAuthCookies();
          setUser(null);
        }
      } else {
        // Solo pulisci i cookie se non ci sono cookie esistenti
        // (evita di pulire durante il caricamento iniziale)
        const existingAuth = getAuthCookie();
        if (!existingAuth) {
          clearAuthCookies();
          setUser(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Funzione per aggiornare il token periodicamente
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      if (auth.currentUser) {
        try {
          const newToken = await auth.currentUser.getIdToken(true); // force refresh
          const cookieAuth = getAuthCookie();
          if (cookieAuth) {
            setAuthCookie(newToken, cookieAuth.userData);
          }
        } catch (error) {
          console.error('Errore nel refresh del token:', error);
          // Se il refresh fallisce, probabilmente l'utente deve rifare login
          clearAuthCookies();
          setUser(null);
        }
      }
    };

    // Refresh ogni 30 minuti (token dura 1 ora)
    const interval = setInterval(refreshToken, 30 * 60 * 1000);
    
    // Refresh anche quando la pagina diventa visibile (utente torna alla tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && auth.currentUser) {
        refreshToken();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};