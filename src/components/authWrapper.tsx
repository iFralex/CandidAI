// components/AuthWrapper.jsx
'use client';

import { useState } from 'react';
import { LoginForm, RegisterForm } from '@/components/login-form';
import { useAuth } from '@/lib/authContext';

export function AuthWrapper({ 
  onAuthSuccess,
  defaultView = 'login' 
}: {
  onAuthSuccess?: (user: any) => void;
  defaultView?: 'login' | 'register';
}) {
  const [currentView, setCurrentView] = useState(defaultView);
  const { user, loading } = useAuth();

  // Se l'utente è già autenticato, non mostrare i form
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Welcome back!</h2>
        <p className="text-muted-foreground mb-4">
          You are logged in as {user.email}
        </p>
        <button
          onClick={() => {
            // Qui puoi implementare il logout
            import('@/lib/auth-utils').then(({ logoutUser }) => {
              logoutUser().then(() => {
                window.location.reload();
              });
            });
          }}
          className="text-sm text-red-600 hover:text-red-800 underline"
        >
          Logout
        </button>
      </div>
    );
  }

  const handleAuthSuccess = (user: any) => {
    console.log('Authentication successful:', user);
    onAuthSuccess?.(user);
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      {currentView === 'login' ? (
        <LoginForm
          onSuccess={handleAuthSuccess}
          onSwitchToRegister={() => setCurrentView('register')}
        />
      ) : (
        <RegisterForm
          onSuccess={handleAuthSuccess}
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}
    </div>
  );
}