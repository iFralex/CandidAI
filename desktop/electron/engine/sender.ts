import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

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

const PROVIDER_URLS: Record<string, string> = {
  gmail: 'https://mail.google.com',
  outlook: 'https://outlook.live.com',
  yahoo: 'https://mail.yahoo.com',
};

let shouldStop = false;

export function stopCampaign(): void {
  shouldStop = true;
}

function getSessionDir(provider: string): string {
  return path.join(app.getPath('userData'), 'sessions', provider);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadToTmp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `cv_${Date.now()}.pdf`);

    function get(getUrl: string): void {
      const mod = getUrl.startsWith('https') ? https : http;
      mod.get(getUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            get(res.headers.location);
          } else {
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
async function sendGmail(page: any, email: EmailItem): Promise<void> {
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
    } catch {
      // Attachment failed — continue without CV
    }
  }

  await page.waitForSelector('[aria-label="Send"]', { timeout: 5000 });
  await page.click('[aria-label="Send"]');
  await delay(1000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendOutlook(page: any, email: EmailItem): Promise<void> {
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
async function sendYahoo(page: any, email: EmailItem): Promise<void> {
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

export async function runCampaign(
  emails: EmailItem[],
  provider: string,
  mainWindow: BrowserWindow,
  onEmailSent: (id: string) => Promise<void>
): Promise<void> {
  shouldStop = false;
  const inboxUrl = PROVIDER_URLS[provider];
  if (!inboxUrl) {
    mainWindow.webContents.send('campaign-error', `Unknown provider: ${provider}`);
    return;
  }

  const userDataDir = getSessionDir(provider);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir,
    } as Parameters<typeof puppeteer.launch>[0]);

    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());

    await page.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for page to settle after initial load / redirect
    await delay(3000);

    for (let i = 0; i < emails.length; i++) {
      if (shouldStop) break;

      const email = emails[i];

      try {
        if (provider === 'gmail') {
          await sendGmail(page, email);
        } else if (provider === 'outlook') {
          await sendOutlook(page, email);
        } else if (provider === 'yahoo') {
          await sendYahoo(page, email);
        }

        await onEmailSent(email.id);

        mainWindow.webContents.send('campaign-progress', {
          sent: i + 1,
          total: emails.length,
        });

        // Wait random human-like delay between sends (skip after last email)
        if (i < emails.length - 1 && !shouldStop) {
          await delay(randomBetween(30_000, 60_000));
        }
      } catch {
        try {
          await browser.close();
        } catch { /* ignore */ }
        browser = null;
        mainWindow.webContents.send(
          'campaign-error',
          'Connection lost or UI changed. Please reconnect your provider.'
        );
        return;
      }
    }
  } catch {
    mainWindow.webContents.send(
      'campaign-error',
      'Connection lost or UI changed. Please reconnect your provider.'
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch { /* ignore */ }
    }
  }
}
