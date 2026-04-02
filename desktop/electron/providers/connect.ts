import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const PROVIDER_URLS: Record<string, string> = {
  gmail: 'https://mail.google.com',
  outlook: 'https://outlook.live.com',
  yahoo: 'https://mail.yahoo.com',
};

const INBOX_INDICATORS: Record<string, string> = {
  gmail: '/mail/u/',
  outlook: '/mail/',
  yahoo: '/d/folders/1',
};

function getSessionDir(provider: string): string {
  return path.join(app.getPath('userData'), 'sessions', provider);
}

export async function connectProvider(
  provider: 'gmail' | 'outlook' | 'yahoo'
): Promise<'connected' | 'error'> {
  const loginUrl = PROVIDER_URLS[provider];
  const inboxIndicator = INBOX_INDICATORS[provider];
  const userDataDir = getSessionDir(provider);

  if (!loginUrl || !inboxIndicator) {
    return 'error';
  }

  try {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir,
    } as Parameters<typeof puppeteer.launch>[0]);

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    // Poll until the user is logged in (inbox URL detected)
    await new Promise<void>((resolve, reject) => {
      const intervalId = setInterval(async () => {
        try {
          const currentUrl = page.url();
          if (currentUrl.includes(inboxIndicator)) {
            clearInterval(intervalId);
            resolve();
          }
        } catch (err) {
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
  } catch {
    return 'error';
  }
}

export function getProviderStatus(provider: string): boolean {
  const sessionDir = getSessionDir(provider);
  if (!fs.existsSync(sessionDir)) {
    return false;
  }

  // Check if Cookies file exists (indicates a saved session)
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
