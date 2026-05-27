#!/usr/bin/env node
/**
 * Copies the built installers into site/public/downloads/
 * so Next.js can serve them as static files.
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const SEARCH_DIRS = [
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '../release'),
];
const DOWNLOADS = path.resolve(ROOT, 'site/public/downloads');

fs.mkdirSync(DOWNLOADS, { recursive: true });

const targets = [
  { pattern: /\.dmg$/, dest: 'CandidAI.dmg'      },
  { pattern: /\.exe$/, dest: 'CandidAI-Setup.exe' },
];

function findNewest(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  let best = null;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        const mtime = fs.statSync(full).mtimeMs;
        if (!best || mtime > best.mtime) best = { full, mtime };
      }
    }
  }
  return best ? best.full : null;
}

let copied = 0;

for (const { pattern, dest } of targets) {
  let src = null;
  for (const dir of SEARCH_DIRS) {
    src = findNewest(dir, pattern);
    if (src) break;
  }
  if (!src) {
    console.warn(`  ⚠  No file matching ${pattern} found under ${SEARCH_DIRS.map(d => path.relative(ROOT, d)).join(' or ')}`);
    continue;
  }
  const dst = path.join(DOWNLOADS, dest);
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓  ${path.relative(ROOT, src)}  →  site/public/downloads/${dest}  (${mb} MB)`);
  copied++;
}

console.log(`\nCopied ${copied}/${targets.length} installer(s) to site/public/downloads/`);
