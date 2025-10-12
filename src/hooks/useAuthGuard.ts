// hooks/useAuthGuard.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export function useAuthGuard(redirectTo = '/login') {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname;
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      router.replace(redirectUrl);
    }
  }, [user, loading, router, redirectTo]);

  return { user, loading, isAuthenticated: !!user };
}

// Hook per proteggere le pagine che non dovrebbero essere accessibili quando autenticati
export function useGuestGuard(redirectTo = '/dashboard') {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  return { user, loading, isAuthenticated: !!user };
}