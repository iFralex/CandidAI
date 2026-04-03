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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectProvider = connectProvider;
exports.getProviderStatus = getProviderStatus;
exports.disconnectProvider = disconnectProvider;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const PROVIDER_URLS = {
    gmail: 'https://mail.google.com',
    outlook: 'https://outlook.live.com',
    yahoo: 'https://mail.yahoo.com',
};
const INBOX_INDICATORS = {
    gmail: '/mail/u/',
    outlook: '/mail/',
    yahoo: '/d/folders/1',
};
function getSessionDir(provider) {
    return path.join(electron_1.app.getPath('userData'), 'sessions', provider);
}
async function connectProvider(provider) {
    const loginUrl = PROVIDER_URLS[provider];
    const inboxIndicator = INBOX_INDICATORS[provider];
    const userDataDir = getSessionDir(provider);
    if (!loginUrl || !inboxIndicator) {
        return 'error';
    }
    try {
        const browser = await puppeteer_extra_1.default.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            userDataDir,
        });
        const pages = await browser.pages();
        const page = pages[0] || (await browser.newPage());
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        // Poll until the user is logged in (inbox URL detected)
        await new Promise((resolve, reject) => {
            const intervalId = setInterval(async () => {
                try {
                    const currentUrl = page.url();
                    if (currentUrl.includes(inboxIndicator)) {
                        clearInterval(intervalId);
                        resolve();
                    }
                }
                catch (err) {
                    clearInterval(intervalId);
                    reject(err);
                }
            }, 2000);
            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(intervalId);
                reject(new Error('Login timeout'));
            }, 5 * 60 * 1000);
        });
        await browser.close();
        return 'connected';
    }
    catch {
        return 'error';
    }
}
function getProviderStatus(provider) {
    const sessionDir = getSessionDir(provider);
    if (!fs.existsSync(sessionDir)) {
        return false;
    }
    // Check if Cookies file exists (indicates a saved session)
    const cookiesFile = path.join(sessionDir, 'Default', 'Cookies');
    const cookiesFileAlt = path.join(sessionDir, 'Cookies');
    return fs.existsSync(cookiesFile) || fs.existsSync(cookiesFileAlt);
}
async function disconnectProvider(provider) {
    const sessionDir = getSessionDir(provider);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
    }
}
