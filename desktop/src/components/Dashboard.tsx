import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getAllEmails,
  getUnsentEmails,
  subscribeToResults,
  updateEmailContent,
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
  X,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Key,
  Mail,
  User as UserIcon,
} from 'lucide-react';

interface Props {
  user: User;
  onSignOut: () => void;
}

type Provider = 'gmail' | 'outlook' | 'resend';
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
    resend: 'disconnected',
  });

  // Resend wizard state
  const [resendWizardOpen, setResendWizardOpen] = useState(false);
  const [resendStep, setResendStep] = useState(0);
  const [resendForm, setResendForm] = useState({ apiKey: '', fromEmail: '', senderName: '' });

  const [campaign, setCampaign] = useState<{ active: boolean; queued: number }>({
    active: false,
    queued: 0,
  });
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<EmailItem | null>(null);

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
    const providers: Provider[] = ['gmail', 'outlook', 'resend'];
    const results = await Promise.all(providers.map((p) => api.getProviderStatus(p)));
    setProviderStatuses({
      gmail: results[0] ? 'connected' : 'disconnected',
      outlook: results[1] ? 'connected' : 'disconnected',
      resend: results[2] ? 'connected' : 'disconnected',
    });
  }, []);

  useEffect(() => {
    loadEmails();
    checkProviderStatuses();
  }, [loadEmails, checkProviderStatuses]);

  // Firestore realtime listener: aggiorna la UI quando il server invia email
  useEffect(() => {
    const unsubscribe = subscribeToResults(user.uid, (sentIds) => {
      setUnsentIds((prev) => {
        // Se non ci sono cambiamenti, non aggiornare
        if (prev.size === sentIds.size && [...prev].every((id) => !sentIds.has(id))) return prev;
        return new Set([...prev].filter((id) => !sentIds.has(id)));
      });
      setPendingEmails((prev) => prev.filter((e) => !sentIds.has(e.id)));
    });
    return unsubscribe;
  }, [user.uid]);

  // Ascolta eventi IPC dal main process
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onCampaignQueued((total) => {
      setCampaign({ active: true, queued: total });
      setCampaignError(null);
    });

    api.onCampaignStopped(() => {
      setCampaign({ active: false, queued: 0 });
    });

    api.onCampaignError((msg) => {
      setCampaignError(msg);
      setCampaign({ active: false, queued: 0 });
    });
  }, []);

  async function handleConnect() {
    if (selectedProvider === 'resend') {
      setResendStep(0);
      setResendForm({ apiKey: '', fromEmail: '', senderName: '' });
      setResendWizardOpen(true);
      return;
    }
    const api = window.electronAPI;
    if (!api) return;
    setConnectError(null);
    setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'connecting' }));
    const result = await api.connectProvider(selectedProvider, user.uid);
    if (result === 'connected') {
      setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'connected' }));
    } else {
      setProviderStatuses((prev) => ({ ...prev, [selectedProvider]: 'disconnected' }));
      setConnectError(
        `Could not connect ${selectedProvider}. Make sure Google Chrome is installed and try again.`
      );
    }
  }

  async function handleConnectResend() {
    const api = window.electronAPI;
    if (!api) return;
    setResendStep(4); // connecting…
    const result = await api.connectResend(
      user.uid,
      resendForm.apiKey,
      resendForm.fromEmail,
      resendForm.senderName,
    );
    if (result === 'connected') {
      setProviderStatuses((prev) => ({ ...prev, resend: 'connected' }));
      setResendWizardOpen(false);
    } else {
      setConnectError('Impossibile salvare la configurazione Resend. Verifica i dati e riprova.');
      setResendWizardOpen(false);
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
    await api.startCampaign({ emails, provider: selectedProvider, userId: user.uid });
  }

  async function handleSendOne(email: EmailItem) {
    const api = window.electronAPI;
    if (!api) return;
    setCampaignError(null);
    const item = cvOverrides[email.id] ? { ...email, cvUrl: cvOverrides[email.id] } : email;
    await api.startCampaign({ emails: [item], provider: selectedProvider, userId: user.uid });
  }

  async function handleStopCampaign() {
    const api = window.electronAPI;
    if (!api) return;
    await api.stopCampaign(user.uid);
    setCampaign({ active: false, queued: 0 });
  }

  async function handleSaveEdit(
    id: string,
    patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>
  ) {
    await updateEmailContent(user.uid, id, patch);
    const applyPatch = (e: EmailItem) => (e.id === id ? { ...e, ...patch } : e);
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
            <option value="resend">Custom Domain</option>
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

        {/* Send All / Stop button */}
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

      {/* Campaign running banner */}
      {campaign.active && (
        <div className="px-6 py-2 bg-blue-900/40 border-b border-blue-700 text-blue-300 text-sm shrink-0 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>
            Campagna in esecuzione sul server — {campaign.queued} email in coda.
            Puoi chiudere l&apos;app, l&apos;invio continuerà in background.
          </span>
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

      {/* Resend onboarding wizard */}
      {resendWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <span className="font-semibold text-white">Set up Custom Domain</span>
              <button onClick={() => setResendWizardOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex gap-1.5 px-6 pt-4">
              {[0, 1, 2, 3].map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= resendStep ? 'bg-blue-500' : 'bg-gray-700'}`} />
              ))}
            </div>

            <div className="px-6 py-6 space-y-4">
              {resendStep === 0 && (
                <>
                  <h2 className="text-lg font-semibold">1. Create a Resend account</h2>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    CandidAI uses <strong>Resend</strong> to send emails from your custom domain.
                    Resend is a professional email delivery service — the free plan includes 3,000 emails/month.
                  </p>
                  <p className="text-gray-400 text-sm">
                    If you don&apos;t have an account yet, sign up at <strong>resend.com</strong>.
                  </p>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://resend.com/signup')}
                    className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Open resend.com <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {resendStep === 1 && (
                <>
                  <h2 className="text-lg font-semibold">2. Add your domain</h2>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    In the Resend dashboard, go to <strong>Domains</strong> and click <strong>Add Domain</strong>.
                    Enter your domain (e.g. <code className="bg-gray-800 px-1 rounded">mysite.com</code>) and follow the instructions to add the DNS records provided by Resend to your domain registrar.
                  </p>
                  <p className="text-gray-400 text-sm">
                    DNS verification may take a few minutes. Wait until the status shows <strong>Verified</strong>.
                  </p>
                  <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 font-mono space-y-1">
                    <div>Resend Dashboard → Domains → Add Domain</div>
                    <div>→ Add TXT/MX records to your DNS provider</div>
                    <div>→ Wait for status: Verified ✓</div>
                  </div>
                </>
              )}

              {resendStep === 2 && (
                <>
                  <h2 className="text-lg font-semibold">3. Get your API Key</h2>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    In the Resend dashboard, go to <strong>API Keys</strong> and click <strong>Create API Key</strong>.
                    Give it a name (e.g. <em>CandidAI</em>), select <strong>Sending access</strong> permission and your verified domain.
                  </p>
                  <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 font-mono space-y-1">
                    <div>Resend Dashboard → API Keys → Create API Key</div>
                    <div>→ Permission: Sending access</div>
                    <div>→ Domain: your verified domain</div>
                    <div>→ Copy the key (shown only once)</div>
                  </div>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://resend.com/api-keys')}
                    className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Open API Keys <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {resendStep === 3 && (
                <>
                  <h2 className="text-lg font-semibold">4. Enter your details</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <Key className="w-3 h-3" /> Resend API Key
                      </label>
                      <input
                        type="password"
                        placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                        value={resendForm.apiKey}
                        onChange={(e) => setResendForm((f) => ({ ...f, apiKey: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Sender email address
                      </label>
                      <input
                        type="email"
                        placeholder="jobs@mysite.com"
                        value={resendForm.fromEmail}
                        onChange={(e) => setResendForm((f) => ({ ...f, fromEmail: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> Display name (shown to recipient)
                      </label>
                      <input
                        type="text"
                        placeholder="John Smith"
                        value={resendForm.senderName}
                        onChange={(e) => setResendForm((f) => ({ ...f, senderName: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {resendStep === 4 && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-gray-300 text-sm">Saving configuration…</p>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            {resendStep < 4 && (
              <div className="flex items-center justify-between px-6 pb-5">
                <button
                  onClick={() => resendStep > 0 ? setResendStep((s) => s - 1) : setResendWizardOpen(false)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {resendStep === 0 ? 'Cancel' : 'Back'}
                </button>
                {resendStep < 3 ? (
                  <button
                    onClick={() => setResendStep((s) => s + 1)}
                    className="flex items-center gap-1 text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleConnectResend}
                    disabled={!resendForm.apiKey || !resendForm.fromEmail || !resendForm.senderName}
                    className="flex items-center gap-1 text-sm px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <Wifi className="w-3.5 h-3.5" /> Connect
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
