import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { connectProvider, disconnectProvider, getProviderStatus } from './providers/connect';

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

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
    // The deep-link URL is passed as a command-line argument on Windows
    const deepLinkUrl = argv.find((arg) => arg.startsWith('candidai://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  // Register custom protocol for deep linking (only when packaged to avoid dev conflicts)
  if (app.isPackaged) {
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

ipcMain.handle('connect-provider', async (_event, provider: 'gmail' | 'outlook' | 'yahoo') => {
  return connectProvider(provider);
});

ipcMain.handle('disconnect-provider', async (_event, provider: string) => {
  return disconnectProvider(provider);
});

ipcMain.handle('get-provider-status', async (_event, provider: string) => {
  return getProviderStatus(provider);
});

// Stub — replaced in Task 10
ipcMain.handle('start-campaign', async (_event, _payload: unknown) => {
  return;
});

// Stub — replaced in Task 10
ipcMain.handle('stop-campaign', async () => {
  return;
});
