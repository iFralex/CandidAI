"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const connect_1 = require("./providers/connect");
const sender_1 = require("./engine/sender");
let mainWindow = null;
function extractTokenFromUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get('token');
    }
    catch {
        return null;
    }
}
function handleDeepLink(url) {
    if (!mainWindow)
        return;
    const token = extractTokenFromUrl(url);
    if (token) {
        mainWindow.webContents.send('auth-success', token);
    }
}
function createWindow() {
    const preload = path.join(__dirname, 'preload.js');
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// macOS: handle deep link via open-url event
electron_1.app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});
// Windows: register single-instance lock and handle deep link via second-instance event
const gotSingleInstanceLock = electron_1.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (_event, argv) => {
        // The deep-link URL is passed as a command-line argument on Windows
        const deepLinkUrl = argv.find((arg) => arg.startsWith('candidai://'));
        if (deepLinkUrl) {
            handleDeepLink(deepLinkUrl);
        }
        // Focus the existing window
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
electron_1.app.whenReady().then(() => {
    // Register custom protocol for deep linking (only when packaged to avoid dev conflicts)
    if (electron_1.app.isPackaged) {
        electron_1.app.setAsDefaultProtocolClient('candidai');
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('open-external-login', async () => {
    await electron_1.shell.openExternal('https://candidai.tech/desktop-login');
});
electron_1.ipcMain.handle('connect-provider', async (_event, provider) => {
    return (0, connect_1.connectProvider)(provider);
});
electron_1.ipcMain.handle('disconnect-provider', async (_event, provider) => {
    return (0, connect_1.disconnectProvider)(provider);
});
electron_1.ipcMain.handle('get-provider-status', async (_event, provider) => {
    return (0, connect_1.getProviderStatus)(provider);
});
electron_1.ipcMain.handle('start-campaign', (_event, payload) => {
    if (!mainWindow)
        return;
    const { emails, provider } = payload;
    const onEmailSent = async (id) => {
        mainWindow?.webContents.send('mark-email-sent', id);
    };
    // Fire and forget — progress reported via IPC events
    void (0, sender_1.runCampaign)(emails, provider, mainWindow, onEmailSent);
});
electron_1.ipcMain.handle('stop-campaign', () => {
    (0, sender_1.stopCampaign)();
});
