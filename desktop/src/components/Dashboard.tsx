import { useCallback, useEffect, useRef, useState } from 'react';
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
import logo from '../assets/logo.png';

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

  useEffect(() => {
    const unsubscribe = subscribeToResults(user.uid, (sentIds) => {
      setUnsentIds((prev) => {
        if (prev.size === sentIds.size && [...prev].every((id) => !sentIds.has(id))) return prev;
        return new Set([...prev].filter((id) => !sentIds.has(id)));
      });
      setPendingEmails((prev) => prev.filter((e) => !sentIds.has(e.id)));
    });
    return unsubscribe;
  }, [user.uid]);

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
    setResendStep(4);
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

  // ─── input / select shared style ───────────────────────────────────────────
  const inputCls =
    'w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/60 transition-colors';
  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--brand-bg)', color: '#f8fafc' }}
    >
      {/* Ambient blobs (fixed, behind everything) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="blob-1 absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }}
        />
        <div
          className="blob-2 absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,5,15,0.7)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-white/10">
            <img src={logo} alt="CandidAI" className="w-full h-full object-cover" />
          </div>
          <span
            className="font-bold text-base tracking-tight"
            style={{ background: 'linear-gradient(to right, #c084fc, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            CandidAI
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-white/35">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-wrap items-center gap-3 px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        {/* Provider selector */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/35 uppercase tracking-widest">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="text-sm rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500/60 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="resend">Custom Domain</option>
          </select>

          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              currentStatus === 'connected'
                ? 'bg-emerald-400'
                : currentStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-white/20'
            }`}
            title={currentStatus}
          />

          {/* Connect / Disconnect */}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <WifiOff className="w-3 h-3" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: isConnecting ? 'none' : '0 0 12px rgba(139,92,246,0.3)',
              }}
            >
              {isConnecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wifi className="w-3 h-3" />
              )}
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Send All / Stop */}
        {campaign.active ? (
          <button
            onClick={handleStopCampaign}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-all duration-150"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            Stop Campaign
          </button>
        ) : (
          <button
            onClick={handleSendAll}
            disabled={!isConnected || pendingEmails.length === 0}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: !isConnected || pendingEmails.length === 0
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399',
              boxShadow: isConnected && pendingEmails.length > 0 ? '0 0 10px rgba(16,185,129,0.15)' : 'none',
            }}
          >
            <Send className="w-3 h-3" />
            Send All Pending ({pendingEmails.length})
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={loadEmails}
          disabled={loading}
          className="text-xs text-white/35 hover:text-white/70 transition-colors ml-auto"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {/* ── Banners ─────────────────────────────────────────────────────────── */}
      {campaign.active && (
        <div
          className="relative z-10 px-5 py-2 text-xs shrink-0 flex items-center gap-2"
          style={{ background: 'rgba(139,92,246,0.1)', borderBottom: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}
        >
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span>
            Campaign running on server — {campaign.queued} emails queued.
            You can close the app; sending continues in background.
          </span>
        </div>
      )}
      {connectError && (
        <div
          className="relative z-10 px-5 py-2 text-xs shrink-0 flex items-center justify-between"
          style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <span>{connectError}</span>
          <button onClick={() => setConnectError(null)} className="ml-4 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {campaignError && (
        <div
          className="relative z-10 px-5 py-2 text-xs shrink-0 flex items-center justify-between"
          style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <span>{campaignError}</span>
          <button onClick={() => setCampaignError(null)} className="ml-4 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex gap-1 px-5 pt-4 shrink-0">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 text-xs font-medium rounded-t-lg transition-all duration-150"
            style={
              tab === t
                ? {
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderBottom: '1px solid transparent',
                    color: '#c4b5fd',
                  }
                : {
                    color: 'rgba(255,255,255,0.35)',
                    border: '1px solid transparent',
                  }
            }
          >
            {t === 'pending' ? `Pending (${pendingEmails.length})` : `All Emails (${allEmails.length})`}
          </button>
        ))}
      </div>

      {/* ── Email table ────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex-1 overflow-auto px-5 pb-5"
        style={{ borderTop: '1px solid rgba(139,92,246,0.2)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500/60" />
          </div>
        ) : displayedEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/25 text-sm">
            <Mail className="w-8 h-8 opacity-30" />
            {tab === 'pending' ? 'No pending emails.' : 'No emails found.'}
          </div>
        ) : (
          <table className="w-full text-sm mt-0 border-collapse">
            <thead>
              <tr
                className="text-left text-[10px] uppercase tracking-widest"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
              >
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
                    className="group transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-3 pr-4 font-medium text-white/90 text-xs">{email.companyName || '—'}</td>
                    <td className="py-3 pr-4 text-white/55 text-xs">
                      {email.recruiterName
                        ? `${email.recruiterName}${email.recruiterTitle ? ` · ${email.recruiterTitle}` : ''}`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-white/55 text-xs max-w-[140px] truncate">{email.to}</td>
                    <td className="py-3 pr-4 text-white/55 text-xs max-w-[180px] truncate">{email.subject}</td>

                    {/* CV chip */}
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => handleCvChipClick(email.id)}
                        className="flex items-center gap-1 text-[10px] rounded-full px-2.5 py-1 transition-colors max-w-[110px] truncate"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
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
                        className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={
                          isPending
                            ? { background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }
                            : { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
                        }
                      >
                        {isPending ? 'Pending' : 'Sent'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingEmail(email)}
                          title="Edit email"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.15)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        >
                          <Pencil className="w-3 h-3 text-white/60" />
                        </button>
                        <button
                          onClick={() => handleSendOne(email)}
                          disabled={!isConnected || campaign.active}
                          title="Send now"
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                          onMouseEnter={(e) => { if (isConnected && !campaign.active) e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16,185,129,0.1)')}
                        >
                          <Send className="w-3 h-3 text-emerald-400" />
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

      {/* ── Resend Wizard ──────────────────────────────────────────────────── */}
      {resendWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div
            className="glass-strong rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 0 60px rgba(139,92,246,0.15)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="font-semibold text-sm text-white">Set up Custom Domain</span>
              <button onClick={() => setResendWizardOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 px-6 pt-5">
              {[0, 1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="h-0.5 flex-1 rounded-full transition-all duration-300"
                  style={{ background: s <= resendStep ? 'linear-gradient(to right, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.08)' }}
                />
              ))}
            </div>

            <div className="px-6 py-6 space-y-4 text-sm">
              {resendStep === 0 && (
                <>
                  <h2 className="font-semibold text-white">1. Create a Resend account</h2>
                  <p className="text-white/55 leading-relaxed">
                    CandidAI uses <strong className="text-white/80">Resend</strong> to send emails from your custom domain.
                    Resend is a professional email delivery service — the free plan includes 3,000 emails/month.
                  </p>
                  <p className="text-white/40 text-xs">
                    If you don&apos;t have an account yet, sign up at <strong>resend.com</strong>.
                  </p>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://resend.com/signup')}
                    className="inline-flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: '#a78bfa' }}
                  >
                    Open resend.com <ExternalLink className="w-3 h-3" />
                  </button>
                </>
              )}

              {resendStep === 1 && (
                <>
                  <h2 className="font-semibold text-white">2. Add your domain</h2>
                  <p className="text-white/55 leading-relaxed">
                    In the Resend dashboard, go to <strong className="text-white/80">Domains</strong> and click <strong className="text-white/80">Add Domain</strong>.
                    Enter your domain and follow the DNS instructions. Wait for status <strong className="text-white/80">Verified</strong>.
                  </p>
                  <div
                    className="rounded-xl p-3 text-xs font-mono space-y-1 text-white/35"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div>Resend Dashboard → Domains → Add Domain</div>
                    <div>→ Add TXT/MX records to your DNS provider</div>
                    <div>→ Wait for status: Verified ✓</div>
                  </div>
                </>
              )}

              {resendStep === 2 && (
                <>
                  <h2 className="font-semibold text-white">3. Get your API Key</h2>
                  <p className="text-white/55 leading-relaxed">
                    In the Resend dashboard, go to <strong className="text-white/80">API Keys</strong> → <strong className="text-white/80">Create API Key</strong>.
                    Select <strong className="text-white/80">Sending access</strong> and your verified domain. Copy the key (shown only once).
                  </p>
                  <div
                    className="rounded-xl p-3 text-xs font-mono space-y-1 text-white/35"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div>Resend Dashboard → API Keys → Create API Key</div>
                    <div>→ Permission: Sending access</div>
                    <div>→ Domain: your verified domain</div>
                    <div>→ Copy the key (shown only once)</div>
                  </div>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://resend.com/api-keys')}
                    className="inline-flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: '#a78bfa' }}
                  >
                    Open API Keys <ExternalLink className="w-3 h-3" />
                  </button>
                </>
              )}

              {resendStep === 3 && (
                <>
                  <h2 className="font-semibold text-white">4. Enter your details</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                        <Key className="w-3 h-3" /> Resend API Key
                      </label>
                      <input
                        type="password"
                        placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                        value={resendForm.apiKey}
                        onChange={(e) => setResendForm((f) => ({ ...f, apiKey: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                        <Mail className="w-3 h-3" /> Sender email address
                      </label>
                      <input
                        type="email"
                        placeholder="jobs@mysite.com"
                        value={resendForm.fromEmail}
                        onChange={(e) => setResendForm((f) => ({ ...f, fromEmail: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                        <UserIcon className="w-3 h-3" /> Display name
                      </label>
                      <input
                        type="text"
                        placeholder="John Smith"
                        value={resendForm.senderName}
                        onChange={(e) => setResendForm((f) => ({ ...f, senderName: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              )}

              {resendStep === 4 && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="w-7 h-7 animate-spin text-violet-400" />
                  <p className="text-white/50 text-xs">Saving configuration…</p>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            {resendStep < 4 && (
              <div
                className="flex items-center justify-between px-6 pb-5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  onClick={() => resendStep > 0 ? setResendStep((s) => s - 1) : setResendWizardOpen(false)}
                  className="flex items-center gap-1 text-xs text-white/35 hover:text-white/70 transition-colors pt-4"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {resendStep === 0 ? 'Cancel' : 'Back'}
                </button>
                {resendStep < 3 ? (
                  <button
                    onClick={() => setResendStep((s) => s + 1)}
                    className="flex items-center gap-1 text-xs px-4 py-2 rounded-lg font-medium transition-all mt-4"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', boxShadow: '0 0 14px rgba(139,92,246,0.3)' }}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleConnectResend}
                    disabled={!resendForm.apiKey || !resendForm.fromEmail || !resendForm.senderName}
                    className="flex items-center gap-1 text-xs px-4 py-2 rounded-lg font-medium transition-all mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', boxShadow: '0 0 12px rgba(16,185,129,0.15)' }}
                  >
                    <Wifi className="w-3 h-3" /> Connect
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
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
