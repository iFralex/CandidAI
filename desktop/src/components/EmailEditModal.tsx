import React, { useState } from 'react';
import type { EmailItem } from '../lib/firestore';
import { X } from 'lucide-react';

interface Props {
  email: EmailItem;
  provider: string;
  isProviderConnected: boolean;
  onSave: (patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>) => void;
  onSendNow: (patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>) => void;
  onClose: () => void;
}

// Stub — fully implemented in Task 8
export default function EmailEditModal({ email, provider, isProviderConnected, onSave, onSendNow, onClose }: Props) {
  const [to, setTo] = useState(email.to);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);

  function getPatch() {
    const patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>> = {};
    if (to !== email.to) patch.to = to;
    if (subject !== email.subject) patch.subject = subject;
    if (body !== email.body) patch.body = body;
    return patch;
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Edit Email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(getPatch())}
            className="text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => onSendNow(getPatch())}
            disabled={!isProviderConnected}
            className="text-sm px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            title={!isProviderConnected ? `Connect ${provider} first` : 'Save and send now'}
          >
            Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
