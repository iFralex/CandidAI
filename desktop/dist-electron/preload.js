"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    onAuthSuccess: (cb) => electron_1.ipcRenderer.on('auth-success', (_event, t) => cb(t)),
    openExternalLogin: () => electron_1.ipcRenderer.invoke('open-external-login'),
    connectProvider: (provider) => electron_1.ipcRenderer.invoke('connect-provider', provider),
    disconnectProvider: (provider) => electron_1.ipcRenderer.invoke('disconnect-provider', provider),
    getProviderStatus: (provider) => electron_1.ipcRenderer.invoke('get-provider-status', provider),
    startCampaign: (payload) => electron_1.ipcRenderer.invoke('start-campaign', payload),
    stopCampaign: () => electron_1.ipcRenderer.invoke('stop-campaign'),
    onCampaignProgress: (cb) => electron_1.ipcRenderer.on('campaign-progress', (_event, p) => cb(p)),
    onCampaignError: (cb) => electron_1.ipcRenderer.on('campaign-error', (_event, m) => cb(m)),
    onMarkEmailSent: (cb) => electron_1.ipcRenderer.on('mark-email-sent', (_event, id) => cb(id)),
});
