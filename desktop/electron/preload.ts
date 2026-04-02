import { contextBridge, ipcRenderer } from 'electron';

export interface CampaignPayload {
  emails: EmailItem[];
  provider: string;
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

  connectProvider: (provider: 'gmail' | 'outlook' | 'yahoo') =>
    ipcRenderer.invoke('connect-provider', provider),

  disconnectProvider: (provider: string) =>
    ipcRenderer.invoke('disconnect-provider', provider),

  getProviderStatus: (provider: string) =>
    ipcRenderer.invoke('get-provider-status', provider),

  startCampaign: (payload: CampaignPayload) =>
    ipcRenderer.invoke('start-campaign', payload),

  stopCampaign: () => ipcRenderer.invoke('stop-campaign'),

  onCampaignProgress: (cb: (p: ProgressPayload) => void) =>
    ipcRenderer.on('campaign-progress', (_event, p: ProgressPayload) => cb(p)),

  onCampaignError: (cb: (msg: string) => void) =>
    ipcRenderer.on('campaign-error', (_event, m: string) => cb(m)),

  onMarkEmailSent: (cb: (id: string) => void) =>
    ipcRenderer.on('mark-email-sent', (_event, id: string) => cb(id)),
});
