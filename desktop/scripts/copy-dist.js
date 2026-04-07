#!/usr/bin/env node
/**
 * Copies the built installers into site/public/downloads/
 * so Next.js can serve them as static files.
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const DIST      = path.resolve(__dirname, '../dist');
const DOWNLOADS = path.resolve(ROOT, 'site/public/downloads');

fs.mkdirSync(DOWNLOADS, { recursive: true });

const targets = [
  { pattern: /\.dmg$/,  dest: 'CandidAI.dmg'       },
  { pattern: /\.exe$/,  dest: 'CandidAI-Setup.exe'  },
];

let copied = 0;

for (const { pattern, dest } of targets) {
  const match = fs.readdirSync(DIST).find(f => pattern.test(f));
  if (!match) {
    console.warn(`  ⚠  No file matching ${pattern} found in dist/`);
    continue;
  }
  const src = path.join(DIST, match);
  const dst = path.join(DOWNLOADS, dest);
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓  ${match}  →  site/public/downloads/${dest}  (${mb} MB)`);
  copied++;
}

console.log(`\nCopied ${copied}/${targets.length} installer(s) to site/public/downloads/`);
