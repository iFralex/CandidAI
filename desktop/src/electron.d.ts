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

export interface CampaignPayload {
  emails: EmailItem[];
  provider: string;
  userId: string;
}

export interface ProgressPayload {
  sent: number;
  total: number;
}

export interface ElectronAPI {
  onAuthSuccess: (cb: (token: string) => void) => void;
  openExternalLogin: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  connectProvider: (provider: 'gmail' | 'outlook', userId: string) => Promise<'connected' | 'error'>;
  connectResend: (userId: string, apiKey: string, fromEmail: string, senderName: string) => Promise<'connected' | 'error'>;
  disconnectProvider: (provider: string) => Promise<void>;
  getProviderStatus: (provider: string) => Promise<boolean>;
  startCampaign: (payload: CampaignPayload) => Promise<void>;
  stopCampaign: (userId: string) => Promise<void>;
  onCampaignQueued: (cb: (total: number) => void) => void;
  onCampaignStopped: (cb: () => void) => void;
  onCampaignProgress: (cb: (p: ProgressPayload) => void) => void;
  onCampaignError: (cb: (msg: string) => void) => void;
  onMarkEmailSent: (cb: (id: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
