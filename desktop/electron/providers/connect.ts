import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer-extra';
import type { Page, Target } from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { findChromePath } from '../utils/chrome';
import { SERVER_URL, SESSION_API_KEY } from '../config';

puppeteer.use(StealthPlugin());

const PROVIDER_URLS: Record<string, string> = {
  gmail: 'https://mail.google.com',
  outlook: 'https://outlook.live.com',
  yahoo: 'https://mail.yahoo.com',
};

const INBOX_INDICATORS: Record<string, string> = {
  gmail: '/mail/u/',
  outlook: '/mail',
  yahoo: '/d/folders/1',
};

function getSessionDir(provider: string): string {
  return path.join(app.getPath('userData'), 'sessions', provider);
}

async function saveSessionToServer(
  userId: string,
  provider: string,
  cookies: object[],
  fingerprint: object,
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/save_session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': SESSION_API_KEY,
    },
    body: JSON.stringify({ user_id: userId, provider, cookies, fingerprint }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`save_session failed: ${res.status} ${JSON.stringify(body)}`);
  }
}

export async function connectProvider(
  provider: 'gmail' | 'outlook' | 'yahoo',
  userId: string,
): Promise<'connected' | 'error'> {
  const loginUrl = PROVIDER_URLS[provider];
  const inboxIndicator = INBOX_INDICATORS[provider];
  const userDataDir = getSessionDir(provider);

  if (!loginUrl || !inboxIndicator) return 'error';

  const executablePath = findChromePath();
  if (!executablePath) {
    console.error('[connect] Cannot find Chrome/Chromium. Please install Google Chrome.');
    return 'error';
  }
  console.log(`[connect] Using Chrome at: ${executablePath}`);

  try {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir,
    } as Parameters<typeof puppeteer.launch>[0]);

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    // Wait until any tab in the browser reaches the inbox URL.
    // Login may open new tabs (e.g. Microsoft's marketing page → login popup),
    // so we monitor all existing and future pages, not just the first one.
    // We ignore matches for the first 3s to skip unauthenticated redirects.
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      let resolved = false;
      const pageListeners = new Map<Page, () => void>();

      const done = (source: string, url: string) => {
        if (resolved) return;
        resolved = true;
        for (const [p, fn] of pageListeners) p.off('framenavigated', fn);
        pageListeners.clear();
        browser.off('targetcreated', onTargetCreated);
        clearTimeout(timeoutId);
        clearTimeout(readyId);
        clearInterval(pollId);
        console.log(`[connect] Login detected via ${source}, url=${url}`);
        resolve();
      };

      const checkPage = (p: Page, source: string) => {
        if (!ready) return;
        try {
          const url = p.url();
          if (url.includes(inboxIndicator)) done(source, url);
        } catch { /* page may be closing */ }
      };

      const watchPage = (p: Page) => {
        const fn = () => checkPage(p, `framenavigated(${p.url()})`);
        pageListeners.set(p, fn);
        p.on('framenavigated', fn);
      };

      const onTargetCreated = async (target: Target) => {
        try {
          const newPage = await target.page();
          if (newPage) {
            console.log(`[connect] New tab opened: ${newPage.url()}`);
            watchPage(newPage);
          }
        } catch { /* ignore */ }
      };

      const pollId = setInterval(() => {
        if (!ready) return;
        browser.pages().then((pages: Page[]) => {
          for (const p of pages) checkPage(p, 'poll');
        }).catch(() => {});
      }, 1000);

      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        for (const [p, fn] of pageListeners) p.off('framenavigated', fn);
        pageListeners.clear();
        browser.off('targetcreated', onTargetCreated);
        clearInterval(pollId);
        clearTimeout(readyId);
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);

      const readyId = setTimeout(() => {
        ready = true;
        console.log(`[connect] 3s elapsed, starting checks`);
        browser.pages().then((pages: Page[]) => {
          for (const p of pages) checkPage(p, 'readyId');
        }).catch(() => {});
      }, 3000);

      browser.on('targetcreated', onTargetCreated);
      watchPage(page);
      console.log(`[connect] Waiting for login on any tab, indicator="${inboxIndicator}"`);
    });

    // Collect all cookies via CDP (catches cross-domain auth cookies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cdpSession = await (page as any).createCDPSession();
    const { cookies } = await cdpSession.send('Network.getAllCookies');

    // Collect browser fingerprint to reproduce on the server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fingerprint = await page.evaluate((): Record<string, any> => ({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: [...navigator.languages],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: { w: screen.width, h: screen.height, depth: screen.colorDepth },
      hardwareConcurrency: navigator.hardwareConcurrency,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deviceMemory: (navigator as any).deviceMemory,
      canvasHash: (() => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return '';
        ctx.fillText('fp', 10, 10);
        return c.toDataURL();
      })(),
    }));

    await browser.close();

    try {
      await saveSessionToServer(userId, provider, cookies, fingerprint);
      console.log(`[connect] Sessione salvata sul server per provider ${provider}`);
    } catch (err) {
      // Non blocca il flusso: la sessione locale è comunque valida
      console.warn('[connect] Impossibile salvare la sessione sul server:', err);
    }

    return 'connected';
  } catch (err) {
    console.error('[connect] connectProvider failed:', err);
    return 'error';
  }
}

export function getProviderStatus(provider: string): boolean {
  if (provider === 'resend') {
    return fs.existsSync(path.join(app.getPath('userData'), 'resend_connected'));
  }
  const sessionDir = getSessionDir(provider);
  if (!fs.existsSync(sessionDir)) return false;
  const cookiesFile = path.join(sessionDir, 'Default', 'Cookies');
  const cookiesFileAlt = path.join(sessionDir, 'Cookies');
  return fs.existsSync(cookiesFile) || fs.existsSync(cookiesFileAlt);
}

export async function disconnectProvider(provider: string): Promise<void> {
  if (provider === 'resend') {
    const marker = path.join(app.getPath('userData'), 'resend_connected');
    if (fs.existsSync(marker)) fs.rmSync(marker);
    return;
  }
  const sessionDir = getSessionDir(provider);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}

export async function connectResend(
  userId: string,
  apiKey: string,
  fromEmail: string,
  senderName: string,
): Promise<'connected' | 'error'> {
  try {
    const res = await fetch(`${SERVER_URL}/save_resend_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': SESSION_API_KEY },
      body: JSON.stringify({ user_id: userId, api_key: apiKey, from_email: fromEmail, sender_name: senderName }),
    });
    if (!res.ok) {
      console.error('[connect] save_resend_config failed:', res.status);
      return 'error';
    }
    // Mark as connected locally
    fs.writeFileSync(path.join(app.getPath('userData'), 'resend_connected'), '');
    console.log('[connect] Resend configurato con successo');
    return 'connected';
  } catch (err) {
    console.error('[connect] connectResend failed:', err);
    return 'error';
  }
}
