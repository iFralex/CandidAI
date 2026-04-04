#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const browsersJsonPath = require.resolve('playwright-core').replace(/index\.js$/, 'browsers.json');
const browsersJson = JSON.parse(fs.readFileSync(browsersJsonPath, 'utf8'));
const chromium = browsersJson.browsers.find(b => b.name === 'chromium');
if (!chromium) { console.error('Chromium entry not found in playwright-core/browsers.json'); process.exit(1); }

const VERSION = chromium.browserVersion;
const CDN = `https://storage.googleapis.com/chrome-for-testing-public/${VERSION}`;

// Google CfT platform slug → zip name → destination folder under browsers/
const PLATFORMS = [
  { platform: 'linux64',   zip: 'chrome-linux64.zip',     dest: 'linux'     },
  { platform: 'mac-x64',   zip: 'chrome-mac-x64.zip',     dest: 'mac-x64'   },
  { platform: 'mac-arm64', zip: 'chrome-mac-arm64.zip',   dest: 'mac-arm64' },
  { platform: 'win64',     zip: 'chrome-win64.zip',       dest: 'win'       },
];

const ROOT = path.resolve(__dirname, '..', '..', 'browsers');

function download(url, destFile) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    const get = (u) => {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

async function downloadPlatform({ platform, zip, dest }) {
  const url = `${CDN}/${platform}/${zip}`;
  const destDir = path.join(ROOT, dest);
  const zipPath = path.join(ROOT, `chromium-${platform}.zip`);

  console.log(`\n[${platform}] Downloading ${url}`);
  fs.mkdirSync(destDir, { recursive: true });
  await download(url, zipPath);

  console.log(`[${platform}] Extracting to browsers/${dest}/`);
  execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`);
  fs.unlinkSync(zipPath);
  console.log(`[${platform}] Done.`);
}

(async () => {
  fs.mkdirSync(ROOT, { recursive: true });
  for (const platform of PLATFORMS) {
    try {
      await downloadPlatform(platform);
    } catch (err) {
      console.error(`[${platform.platform}] Failed: ${err.message}`);
    }
  }
  console.log('\nAll platforms downloaded.');
})();
