import React, { useEffect, useState } from 'react';
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
    // Listen for the deep-link auth token from the Main process
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
            <img src={logo} alt="CandidAI" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">CandidAI</h1>
          <p className="text-gray-400 text-sm text-center">
            Send your job application emails in bulk — stealth &amp; human-like.
          </p>
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={status === 'waiting'}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-md"
        >
          {status === 'waiting' ? 'Waiting for browser login…' : 'Login with CandidAI'}
        </button>

        {/* Status messages */}
        {status === 'waiting' && (
          <p className="text-gray-400 text-sm text-center">
            Complete the login in your browser, then return here.
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
