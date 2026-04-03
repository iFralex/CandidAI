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
exports.stopCampaign = stopCampaign;
exports.runCampaign = runCampaign;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const PROVIDER_URLS = {
    gmail: 'https://mail.google.com',
    outlook: 'https://outlook.live.com',
    yahoo: 'https://mail.yahoo.com',
};
let shouldStop = false;
function stopCampaign() {
    shouldStop = true;
}
function getSessionDir(provider) {
    return path.join(electron_1.app.getPath('userData'), 'sessions', provider);
}
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function downloadToTmp(url) {
    return new Promise((resolve, reject) => {
        const tmpFile = path.join(os.tmpdir(), `cv_${Date.now()}.pdf`);
        function get(getUrl) {
            const mod = getUrl.startsWith('https') ? https : http;
            mod.get(getUrl, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    if (res.headers.location) {
                        get(res.headers.location);
                    }
                    else {
                        reject(new Error('Redirect without location header'));
                    }
                    return;
                }
                const fileStream = fs.createWriteStream(tmpFile);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(tmpFile);
                });
                fileStream.on('error', reject);
            }).on('error', reject);
        }
        get(url);
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendGmail(page, email) {
    // Press 'c' keyboard shortcut to open compose window
    await page.keyboard.press('c');
    await page.waitForSelector('[name="to"]', { timeout: 10000 });
    await page.type('[name="to"]', email.to, { delay: 30 });
    await page.keyboard.press('Tab');
    await page.waitForSelector('[name="subjectbox"]', { timeout: 5000 });
    await page.type('[name="subjectbox"]', email.subject, { delay: 30 });
    await page.waitForSelector('div[aria-label="Message Body"]', { timeout: 5000 });
    await page.click('div[aria-label="Message Body"]');
    await page.type('div[aria-label="Message Body"]', email.body, { delay: 30 });
    if (email.cvUrl) {
        try {
            const tmpPath = await downloadToTmp(email.cvUrl);
            const attachInput = await page.$('input[type="file"]');
            if (attachInput) {
                await attachInput.uploadFile(tmpPath);
                await delay(2000);
            }
        }
        catch {
            // Attachment failed — continue without CV
        }
    }
    await page.waitForSelector('[aria-label="Send"]', { timeout: 5000 });
    await page.click('[aria-label="Send"]');
    await delay(1000);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendOutlook(page, email) {
    await page.waitForSelector('[aria-label="New message"], [aria-label="New Mail"]', { timeout: 15000 });
    await page.click('[aria-label="New message"], [aria-label="New Mail"]');
    await page.waitForSelector('input[aria-label="To"]', { timeout: 10000 });
    await page.type('input[aria-label="To"]', email.to, { delay: 30 });
    await page.keyboard.press('Tab');
    await page.waitForSelector('input[aria-label="Subject"]', { timeout: 5000 });
    await page.type('input[aria-label="Subject"]', email.subject, { delay: 30 });
    await page.waitForSelector('div[aria-label="Message body"]', { timeout: 5000 });
    await page.click('div[aria-label="Message body"]');
    await page.type('div[aria-label="Message body"]', email.body, { delay: 30 });
    await page.waitForSelector('[aria-label="Send"]', { timeout: 5000 });
    await page.click('[aria-label="Send"]');
    await delay(1000);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendYahoo(page, email) {
    await page.waitForSelector('[data-test-id="compose-button"]', { timeout: 15000 });
    await page.click('[data-test-id="compose-button"]');
    await page.waitForSelector('input[aria-label="To"]', { timeout: 10000 });
    await page.type('input[aria-label="To"]', email.to, { delay: 30 });
    await page.keyboard.press('Tab');
    await page.waitForSelector('input[aria-label="Subject"]', { timeout: 5000 });
    await page.type('input[aria-label="Subject"]', email.subject, { delay: 30 });
    await page.waitForSelector('div[aria-label="Message body"]', { timeout: 5000 });
    await page.click('div[aria-label="Message body"]');
    await page.type('div[aria-label="Message body"]', email.body, { delay: 30 });
    await page.waitForSelector('[data-test-id="send-button"]', { timeout: 5000 });
    await page.click('[data-test-id="send-button"]');
    await delay(1000);
}
async function runCampaign(emails, provider, mainWindow, onEmailSent) {
    shouldStop = false;
    const inboxUrl = PROVIDER_URLS[provider];
    if (!inboxUrl) {
        mainWindow.webContents.send('campaign-error', `Unknown provider: ${provider}`);
        return;
    }
    const userDataDir = getSessionDir(provider);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser = null;
    try {
        browser = await puppeteer_extra_1.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            userDataDir,
        });
        const pages = await browser.pages();
        const page = pages[0] ?? (await browser.newPage());
        await page.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait for page to settle after initial load / redirect
        await delay(3000);
        for (let i = 0; i < emails.length; i++) {
            if (shouldStop)
                break;
            const email = emails[i];
            try {
                if (provider === 'gmail') {
                    await sendGmail(page, email);
                }
                else if (provider === 'outlook') {
                    await sendOutlook(page, email);
                }
                else if (provider === 'yahoo') {
                    await sendYahoo(page, email);
                }
                await onEmailSent(email.id);
                mainWindow.webContents.send('campaign-progress', {
                    sent: i + 1,
                    total: emails.length,
                });
                // Wait random human-like delay between sends (skip after last email)
                if (i < emails.length - 1 && !shouldStop) {
                    await delay(randomBetween(30000, 60000));
                }
            }
            catch {
                try {
                    await browser.close();
                }
                catch { /* ignore */ }
                browser = null;
                mainWindow.webContents.send('campaign-error', 'Connection lost or UI changed. Please reconnect your provider.');
                return;
            }
        }
    }
    catch {
        mainWindow.webContents.send('campaign-error', 'Connection lost or UI changed. Please reconnect your provider.');
    }
    finally {
        if (browser) {
            try {
                await browser.close();
            }
            catch { /* ignore */ }
        }
    }
}
