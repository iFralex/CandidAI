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
exports.attachCV = attachCV;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function downloadToTmp(url) {
    return new Promise((resolve, reject) => {
        const ext = url.includes('.pdf') ? '.pdf' : '.bin';
        const tmpFile = path.join(os.tmpdir(), `cv_attach_${Date.now()}${ext}`);
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
async function attachCV(page, cvUrl, provider) {
    const tmpPath = await downloadToTmp(cvUrl);
    if (provider === 'gmail') {
        // Gmail exposes a hidden <input type="file"> that can be targeted directly
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            throw new Error('Gmail file input not found');
        }
        // ElementHandle.uploadFile is a puppeteer API for setting file inputs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await fileInput.uploadFile(tmpPath);
        // Wait for the attachment chip to appear (Gmail shows a progress bar then chip)
        await page.waitForSelector('[data-tooltip="Remove attachment"], [aria-label*="Attachment"]', {
            timeout: 15000,
        });
    }
    else if (provider === 'outlook') {
        // Outlook has an attach button; clicking it reveals a hidden file input
        const attachBtn = await page.$('[aria-label="Attach"], [title="Attach"], button[title*="ttach"]');
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
        await fileInput.uploadFile(tmpPath);
        // Wait for attachment chip
        await page.waitForSelector('[aria-label*="Remove"], [title*="Remove"], .ms-AttachmentItem', { timeout: 15000 });
    }
    else {
        // Yahoo Mail — click the attach paperclip icon
        const attachBtn = await page.$('[data-test-id="attach-button"], [aria-label*="Attach"], [title*="Attach"]');
        if (attachBtn) {
            await attachBtn.click();
            await page.waitForSelector('input[type="file"]', { timeout: 5000 });
        }
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            throw new Error('Yahoo file input not found');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await fileInput.uploadFile(tmpPath);
        // Wait for attachment chip in Yahoo
        await page.waitForSelector('[data-test-id="attachment-item"], [class*="attachment"]', { timeout: 15000 });
    }
}
