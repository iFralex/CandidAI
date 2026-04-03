import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getAllEmails,
  getUnsentEmails,
  updateEmailContent,
  updateEmailSent,
} from '../lib/firestore';
import type { EmailItem } from '../lib/firestore';
import EmailEditModal from './EmailEditModal';
import {
  FileText,
  Loader2,
  Pencil,
  Send,
  WifiOff,
  Wifi,
} from 'lucide-react';

interface Props {
  user: User;
  onSignOut: () => void;
}

type Provider = 'gmail' | 'outlook' | 'yahoo';
type ProviderStatus = 'connected' | 'disconnected' | 'connecting';

export default function Dashboard({ user, onSignOut }: Props) {
  const [pendingEmails, setPendingEmails] = useState<EmailItem[]>([]);
  const [allEmails, setAllEmails] = useState<EmailItem[]>([]);
  const [unsentIds, setUnsentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const [selectedProvider, setSelectedProvider] = useState<Provider>('gmail');
  const [providerStatuses, setProviderStatuses] = useState<Record<Provider, ProviderStatus>>({
    gmail: 'disconnected',
    outlook: 'disconnected',
    yahoo: 'disconnected',
  });

  const [campaign, setCampaign] = useState<{ active: boolean; sent: number; total: number }>({
    active: false,
    sent: 0,
    total: 0,
  });
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<EmailItem | null>(null);

  // Per-row CV override refs
  const cvInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cvOverrides, setCvOverrides] = useState<Record<string, string>>({});

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, all] = await Promise.all([
        getUnsentEmails(user.uid),
        getAllEmails(user.uid),
      ]);
      setPendingEmails(pending);
      setAllEmails(all);
      setUnsentIds(new Set(pending.map((e) => e.id)));
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  const checkProviderStatuses = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    const providers: Provider[] = ['gmail', 'outlook', 'yahoo'];
    const results = await Promise.all(providers.map((p) => api.getProviderStatus(p)));
    setProviderStatuses({
      gmail: results[0] ? 'connected' : 'disconnected',
      outlook: results[1] ? 'connected' : 'disconnected',
      yahoo: results[2] ? 'connected' : 'disconnected',
    });
  }, []);

  useEffect(() => {
    loadEmails();
    checkProviderStatuses();
  }, [loadEmails, checkProviderStatuses]);

  // Listen for campaign progress and errors
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.onCampaignProgress((p) => {
      setCampaign({ active: true, sent: p.sent, total: p.total });
      if (p.sent >= p.total) {
        setCampaign((prev) => ({ ...prev, active: false }));
        loadEmails();
      }
    });
    api.onCampaignError((msg) => {
      setCampaignError(msg);
      setCampaign((prev) => ({ ...prev, active: false }));
    });
  }, [loadEmails]);

  // Update Firestore and local state when main process marks an email as sent
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.onMarkEmailSent(async (id) => {
      try {
        await updateEmailSent(user.uid, id, true);
      } catch {
        // Firestore update failed silently — UI state still updated
      }
      setUnsentIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPendingEmails((prev) => prev.filter((e) => e.id !== id));
    });
  }, [user.uid]);

  async function handleConnect() {
    const api = window.electronAPI;
    if (!api) return;
    setConnectError(null);
    setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'connecting' }));
    const result = await api.connectProvider(selectedProvider);
    if (result === 'connected') {
      setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'connected' }));
    } else {
      setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'disconnected' }));
      setConnectError(
        `Could not connect ${selectedProvider}. Make sure Google Chrome is installed and try again.`
      );
    }
  }

  async function handleDisconnect() {
    const api = window.electronAPI;
    if (!api) return;
    await api.disconnectProvider(selectedProvider);
    setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'disconnected' }));
  }

  async function handleSendAll() {
    const api = window.electronAPI;
    if (!api) return;
    setCampaignError(null);
    const emails = pendingEmails.map((e) =>
      cvOverrides[e.id] ? { ...e, cvUrl: cvOverrides[e.id] } : e
    );
    setCampaign({ active: true, sent: 0, total: emails.length });
    await api.startCampaign({ emails, provider: selectedProvider });
  }

  async function handleSendOne(email: EmailItem) {
    const api = window.electronAPI;
    if (!api) return;
    setCampaignError(null);
    const item = cvOverrides[email.id] ? { ...email, cvUrl: cvOverrides[email.id] } : email;
    setCampaign({ active: true, sent: 0, total: 1 });
    await api.startCampaign({ emails: [item], provider: selectedProvider });
  }

  async function handleStopCampaign() {
    const api = window.electronAPI;
    if (!api) return;
    await api.stopCampaign();
    setCampaign((prev) => ({ ...prev, active: false }));
  }

  async function handleSaveEdit(
    id: string,
    patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>
  ) {
    await updateEmailContent(user.uid, id, patch);
    // Optimistic update
    const applyPatch = (e: EmailItem) =>
      e.id === id ? { ...e, ...patch } : e;
    setPendingEmails((prev) => prev.map(applyPatch));
    setAllEmails((prev) => prev.map(applyPatch));
    setEditingEmail(null);
  }

  function handleCvChipClick(id: string) {
    cvInputRefs.current[id]?.click();
  }

  function handleCvFileChange(id: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setCvOverrides((prev) => ({ ...prev, [id]: files[0].name }));
  }

  async function handleSignOut() {
    await signOut(auth);
    onSignOut();
  }

  const currentStatus = providerStatuses[selectedProvider];
  const isConnected = currentStatus === 'connected';
  const isConnecting = currentStatus === 'connecting';
  const displayedEmails = tab === 'pending' ? pendingEmails : allEmails;

  function cvFilename(cvUrl: string): string {
    if (!cvUrl) return 'No CV';
    try {
      const segments = cvUrl.split('/');
      const last = segments[segments.length - 1];
      return decodeURIComponent(last.split('?')[0]) || 'CV';
    } catch {
      return 'CV';
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        {/* Provider selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="bg-gray-800 text-white text-sm rounded-md px-3 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="yahoo">Yahoo</option>
          </select>

          {/* Status dot */}
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              currentStatus === 'connected'
                ? 'bg-green-400'
                : currentStatus === 'connecting'
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-gray-500'
            }`}
            title={currentStatus}
          />

          {/* Connect / Disconnect button */}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <WifiOff className="w-3.5 h-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>

        {/* Send All Pending button */}
        {campaign.active ? (
          <button
            onClick={handleStopCampaign}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md bg-red-600 hover:bg-red-500 transition-colors"
          >
            Stop Campaign
          </button>
        ) : (
          <button
            onClick={handleSendAll}
            disabled={!isConnected || pendingEmails.length === 0}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send All Pending ({pendingEmails.length})
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={loadEmails}
          disabled={loading}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {/* Progress bar */}
      {campaign.active && campaign.total > 0 && (
        <div className="px-6 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(campaign.sent / campaign.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {campaign.sent} / {campaign.total} sent
            </span>
          </div>
        </div>
      )}

      {/* Connect error banner */}
      {connectError && (
        <div className="px-6 py-2 bg-red-900/40 border-b border-red-700 text-red-300 text-sm shrink-0 flex items-center justify-between">
          <span>{connectError}</span>
          <button
            onClick={() => setConnectError(null)}
            className="text-red-400 hover:text-red-200 ml-4 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error banner */}
      {campaignError && (
        <div className="px-6 py-2 bg-red-900/40 border-b border-red-700 text-red-300 text-sm shrink-0 flex items-center justify-between">
          <span>{campaignError}</span>
          <button
            onClick={() => setCampaignError(null)}
            className="text-red-400 hover:text-red-200 ml-4 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 shrink-0">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md transition-colors ${
              tab === t
                ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'pending' ? `Pending (${pendingEmails.length})` : `All Emails (${allEmails.length})`}
          </button>
        ))}
      </div>

      {/* Email table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : displayedEmails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            {tab === 'pending' ? 'No pending emails.' : 'No emails found.'}
          </div>
        ) : (
          <table className="w-full text-sm mt-0 border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Company</th>
                <th className="pb-2 pr-4 font-medium">Recruiter</th>
                <th className="pb-2 pr-4 font-medium">To</th>
                <th className="pb-2 pr-4 font-medium">Subject</th>
                <th className="pb-2 pr-4 font-medium">CV</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedEmails.map((email) => {
                const isPending = unsentIds.has(email.id);
                const cvLabel = cvOverrides[email.id] || cvFilename(email.cvUrl);
                return (
                  <tr
                    key={email.id}
                    className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group"
                  >
                    <td className="py-3 pr-4 font-medium">{email.companyName || '—'}</td>
                    <td className="py-3 pr-4 text-gray-300">
                      {email.recruiterName
                        ? `${email.recruiterName}${email.recruiterTitle ? ` · ${email.recruiterTitle}` : ''}`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-300 max-w-[160px] truncate">{email.to}</td>
                    <td className="py-3 pr-4 text-gray-300 max-w-[200px] truncate">{email.subject}</td>

                    {/* CV chip */}
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleCvChipClick(email.id)}
                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-full px-2.5 py-1 transition-colors max-w-[120px] truncate"
                        title={cvLabel}
                      >
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="truncate">{cvLabel}</span>
                      </button>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        ref={(el) => { cvInputRefs.current[email.id] = el; }}
                        onChange={(e) => handleCvFileChange(email.id, e.target.files)}
                      />
                    </td>

                    {/* Status badge */}
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPending
                            ? 'bg-amber-900/50 text-amber-300'
                            : 'bg-green-900/50 text-green-300'
                        }`}
                      >
                        {isPending ? 'Pending' : 'Sent'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingEmail(email)}
                          title="Edit email"
                          className="p-1.5 rounded-md hover:bg-gray-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendOne(email)}
                          disabled={!isConnected || campaign.active}
                          title="Send now"
                          className="p-1.5 rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editingEmail && (
        <EmailEditModal
          email={editingEmail}
          provider={selectedProvider}
          isProviderConnected={isConnected}
          onSave={(patch) => handleSaveEdit(editingEmail.id, patch)}
          onSendNow={(patch) => {
            handleSaveEdit(editingEmail.id, patch).then(() =>
              handleSendOne({ ...editingEmail, ...patch })
            );
          }}
          onClose={() => setEditingEmail(null)}
        />
      )}
    </div>
  );
}
