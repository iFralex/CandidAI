import { contextBridge, ipcRenderer } from 'electron';

export interface CampaignPayload {
  emails: EmailItem[];
  provider: string;
  userId: string;
}

export interface EmailItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  cvUrl: string;
  companyName: string;
  recruiterName: string;
  recruiterTitle: string;
}

export interface ProgressPayload {
  sent: number;
  total: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  onAuthSuccess: (cb: (token: string) => void) =>
    ipcRenderer.on('auth-success', (_event, t: string) => cb(t)),

  openExternalLogin: () => ipcRenderer.invoke('open-external-login'),

  connectProvider: (provider: 'gmail' | 'outlook' | 'yahoo', userId: string) =>
    ipcRenderer.invoke('connect-provider', { provider, userId }),

  disconnectProvider: (provider: string) =>
    ipcRenderer.invoke('disconnect-provider', provider),

  getProviderStatus: (provider: string) =>
    ipcRenderer.invoke('get-provider-status', provider),

  startCampaign: (payload: CampaignPayload) =>
    ipcRenderer.invoke('start-campaign', payload),

  stopCampaign: (userId: string) => ipcRenderer.invoke('stop-campaign', userId),

  onCampaignQueued: (cb: (total: number) => void) =>
    ipcRenderer.on('campaign-queued', (_event, total: number) => cb(total)),

  onCampaignStopped: (cb: () => void) =>
    ipcRenderer.on('campaign-stopped', () => cb()),

  onCampaignError: (cb: (msg: string) => void) =>
    ipcRenderer.on('campaign-error', (_event, m: string) => cb(m)),
});
