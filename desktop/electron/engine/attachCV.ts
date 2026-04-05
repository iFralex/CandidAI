import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from 'puppeteer-core';

function downloadToTmp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = url.includes('.pdf') ? '.pdf' : '.bin';
    const tmpFile = path.join(os.tmpdir(), `cv_attach_${Date.now()}${ext}`);

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
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading CV`));
          return;
        }
        const fileStream = fs.createWriteStream(tmpFile);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tmpFile);
        });
        fileStream.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    }

    get(url);
  });
}

export async function attachCV(
  page: Page,
  cvUrl: string,
  provider: 'gmail' | 'outlook' | 'yahoo'
): Promise<void> {
  const tmpPath = await downloadToTmp(cvUrl);

  if (provider === 'gmail') {
    // Gmail exposes a hidden <input type="file"> that can be targeted directly
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('Gmail file input not found');
    }
    // ElementHandle.uploadFile is a puppeteer API for setting file inputs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fileInput as any).uploadFile(tmpPath);
    // Wait for the attachment chip to appear (Gmail shows a progress bar then chip)
    await page.waitForSelector('[data-tooltip="Remove attachment"], [aria-label*="Attachment"]', {
      timeout: 15000,
    });
  } else if (provider === 'outlook') {
    // Outlook has an attach button; clicking it reveals a hidden file input
    const attachBtn = await page.$(
      '[aria-label="Attach"], [title="Attach"], button[title*="ttach"]'
    );
    if (attachBtn) {
      await attachBtn.click();
      // Wait for the sub-menu / file input to appear
      await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    }
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('Outlook file input not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fileInput as any).uploadFile(tmpPath);
    // Wait for attachment chip
    await page.waitForSelector(
      '[aria-label*="Remove"], [title*="Remove"], .ms-AttachmentItem',
      { timeout: 15000 }
    );
  } else {
    // Yahoo Mail — click the attach paperclip icon
    const attachBtn = await page.$(
      '[data-test-id="attach-button"], [aria-label*="Attach"], [title*="Attach"]'
    );
    if (attachBtn) {
      await attachBtn.click();
      await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    }
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('Yahoo file input not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fileInput as any).uploadFile(tmpPath);
    // Wait for attachment chip in Yahoo
    await page.waitForSelector(
      '[data-test-id="attachment-item"], [class*="attachment"]',
      { timeout: 15000 }
    );
  }
}
