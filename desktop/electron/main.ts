import './loadEnv';
import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

app.setName('CandidAI');
import { connectProvider, connectResend, disconnectProvider, getProviderStatus } from './providers/connect';
import { startRemoteCampaign, stopRemoteCampaign } from './engine/sender';
import type { EmailItem } from './engine/sender';

function setupFileLogger(): void {
  const logDir = app.getPath('logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'main.log');
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  const ts = () => new Date().toISOString();
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args) => { orig.log(...args); stream.write(`[${ts()}] LOG   ${args.join(' ')}\n`); };
  console.warn = (...args) => { orig.warn(...args); stream.write(`[${ts()}] WARN  ${args.join(' ')}\n`); };
  console.error = (...args) => { orig.error(...args); stream.write(`[${ts()}] ERROR ${args.join(' ')}\n`); };
  process.on('uncaughtException', (err) => stream.write(`[${ts()}] UNCAUGHT ${err.stack ?? err.message}\n`));
  process.on('unhandledRejection', (reason) => stream.write(`[${ts()}] UNHANDLED_REJECTION ${reason}\n`));
  console.log(`Log file: ${logPath}`);
}

let mainWindow: BrowserWindow | null = null;

function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

function handleDeepLink(url: string): void {
  if (!mainWindow) return;
  const token = extractTokenFromUrl(url);
  if (token) {
    mainWindow.webContents.send('auth-success', token);
  }
}

function createWindow(): void {
  const preload = path.join(__dirname, 'preload.js');

  // In dev __dirname = desktop/dist-electron → ../assets = desktop/assets
  // In packaged mode electron-builder embeds the icon from the bundle automatically
  let icon: ReturnType<typeof nativeImage.createFromPath> | undefined;
  if (!app.isPackaged) {
    const ext = process.platform === 'win32' ? 'ico' : 'icns';
    const iconPath = path.join(__dirname, `../assets/icon.${ext}`);
    if (fs.existsSync(iconPath)) icon = nativeImage.createFromPath(iconPath);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CandidAI',
    ...(icon ? { icon } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin' && icon && !icon.isEmpty()) {
    app.dock?.setIcon(icon);
  }

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// macOS: handle deep link via open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows: register single-instance lock and handle deep link via second-instance event
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLinkUrl = argv.find((arg) => arg.startsWith('candidai://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    setupFileLogger();
    app.setAsDefaultProtocolClient('candidai');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

ipcMain.handle('open-external-login', async () => {
  await shell.openExternal('https://candidai.tech/desktop-login');
});

ipcMain.handle('open-external', async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle(
  'connect-provider',
  async (_event, payload: { provider: 'gmail' | 'outlook'; userId: string }) => {
    return connectProvider(payload.provider, payload.userId);
  },
);

ipcMain.handle(
  'connect-resend',
  async (_event, payload: { userId: string; apiKey: string; fromEmail: string; senderName: string }) => {
    return connectResend(payload.userId, payload.apiKey, payload.fromEmail, payload.senderName);
  },
);

ipcMain.handle('disconnect-provider', async (_event, provider: string) => {
  return disconnectProvider(provider);
});

ipcMain.handle('get-provider-status', async (_event, provider: string) => {
  return getProviderStatus(provider);
});

ipcMain.handle(
  'start-campaign',
  (_event, payload: { emails: EmailItem[]; provider: string; userId: string }) => {
    if (!mainWindow) return;
    void startRemoteCampaign(payload.userId, payload.emails, payload.provider, mainWindow);
  },
);

ipcMain.handle('stop-campaign', (_event, userId: string) => {
  if (!mainWindow) return;
  void stopRemoteCampaign(userId, mainWindow);
});
