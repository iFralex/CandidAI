import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer-extra';
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

    // Wait until the user is logged in by listening to every navigation event.
    // We delay the first check by 3s to skip the initial automatic redirects
    // that happen before the login page even renders.
    await new Promise<void>((resolve, reject) => {
      let ready = false;

      const cleanup = () => {
        page.off('framenavigated', onNavigated);
        clearTimeout(timeoutId);
        clearTimeout(readyId);
      };

      const onNavigated = () => {
        if (!ready) return;
        try {
          if (page.url().includes(inboxIndicator)) {
            cleanup();
            resolve();
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Login timeout'));
      }, 5 * 60 * 1000);

      // Start listening only after 3s, once the initial redirects have settled
      const readyId = setTimeout(() => {
        ready = true;
        if (page.url().includes(inboxIndicator)) {
          cleanup();
          resolve();
        }
      }, 3000);

      page.on('framenavigated', onNavigated);
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
  const sessionDir = getSessionDir(provider);
  if (!fs.existsSync(sessionDir)) return false;
  const cookiesFile = path.join(sessionDir, 'Default', 'Cookies');
  const cookiesFileAlt = path.join(sessionDir, 'Cookies');
  return fs.existsSync(cookiesFile) || fs.existsSync(cookiesFileAlt);
}

export async function disconnectProvider(provider: string): Promise<void> {
  const sessionDir = getSessionDir(provider);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
}
