import React from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface Props {
  user: User;
  onSignOut: () => void;
}

// Placeholder — fully implemented in Task 7
export default function Dashboard({ user, onSignOut }: Props) {
  async function handleSignOut() {
    await signOut(auth);
    onSignOut();
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-lg">CandidAI</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Dashboard loading… (Task 7)</p>
      </main>
    </div>
  );
}
