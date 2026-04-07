import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './lib/firebase';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthState('authenticated');
      } else {
        setUser(null);
        setAuthState('unauthenticated');
      }
    });
    return unsubscribe;
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--brand-bg)' }}>
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="blob-1 absolute top-1/4 left-1/4 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
          <div className="blob-2 absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }} />
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          <span className="text-sm text-white/40 tracking-wide">Loading…</span>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen onAuthenticated={(u) => { setUser(u); setAuthState('authenticated'); }} />;
  }

  return <Dashboard user={user!} onSignOut={() => setAuthState('unauthenticated')} />;
}
