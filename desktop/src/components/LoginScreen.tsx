import { useEffect, useState } from 'react';
import logo from '../assets/logo.png';
import type { User } from 'firebase/auth';
import { signInWithCustomToken } from '../lib/firebase';

interface Props {
  onAuthenticated: (user: User) => void;
}

export default function LoginScreen({ onAuthenticated }: Props) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    window.electronAPI.onAuthSuccess(async (token: string) => {
      setStatus('waiting');
      setErrorMsg('');
      try {
        const credential = await signInWithCustomToken(token);
        onAuthenticated(credential.user);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        setStatus('error');
      }
    });
  }, [onAuthenticated]);

  function handleLogin() {
    setStatus('waiting');
    setErrorMsg('');
    window.electronAPI.openExternalLogin();
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center h-screen overflow-hidden"
      style={{ background: 'var(--brand-bg)' }}
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="blob-1 absolute -top-20 -left-20 w-[480px] h-[480px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }}
        />
        <div
          className="blob-2 absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }}
        />
        <div
          className="blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent 70%)' }}
        />
      </div>

      {/* Card */}
      <div className="relative glass-strong rounded-2xl w-full max-w-sm mx-6 px-8 py-10 flex flex-col items-center gap-8 shadow-2xl">

        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/10">
            <img src={logo} alt="CandidAI" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ background: 'linear-gradient(to right, #c084fc, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              CandidAI
            </h1>
            <p className="text-white/50 text-sm text-center leading-relaxed">
              Send job applications in bulk —<br />stealth &amp; human-like.
            </p>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={status === 'waiting'}
          className="w-full py-3 px-6 font-semibold rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: status === 'waiting'
              ? 'rgba(139,92,246,0.4)'
              : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff',
            boxShadow: status !== 'waiting' ? '0 0 24px rgba(139,92,246,0.35)' : 'none',
          }}
        >
          {status === 'waiting' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Waiting for browser login…
            </span>
          ) : (
            'Login with CandidAI'
          )}
        </button>

        {/* Messages */}
        {status === 'waiting' && (
          <p className="text-white/40 text-xs text-center">
            Complete the login in your browser, then return here.
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
