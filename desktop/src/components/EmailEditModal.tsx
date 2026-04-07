import { useState } from 'react';
import type { EmailItem } from '../lib/firestore';
import { X, Send } from 'lucide-react';

interface Props {
  email: EmailItem;
  provider: string;
  isProviderConnected: boolean;
  onSave: (patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>) => void;
  onSendNow: (patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>) => void;
  onClose: () => void;
}

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

  const inputCls =
    'w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/60 transition-colors';
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-2xl flex flex-col gap-0 overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(139,92,246,0.12)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h2 className="text-sm font-semibold text-white">Edit Email</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] text-white/35 uppercase tracking-widest mb-1.5">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className={`${inputCls} font-mono resize-none`}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(getPatch())}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#c4b5fd',
            }}
          >
            Save
          </button>
          <button
            onClick={() => onSendNow(getPatch())}
            disabled={!isProviderConnected}
            title={!isProviderConnected ? `Connect ${provider} first` : 'Save and send now'}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399',
              boxShadow: isProviderConnected ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
            }}
          >
            <Send className="w-3 h-3" />
            Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
