import * as fs from 'fs';
import * as path from 'path';

// Cerca .env.local nella root del progetto (due livelli sopra dist-electron/)
// oppure usando process.cwd() che in dev punta a desktop/
const candidates = [
  path.join(__dirname, '../../.env.local'),  // dist-electron/ → project root
  path.join(process.cwd(), '../.env.local'), // desktop/ → project root
];

for (const envFile of candidates) {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const raw = trimmed.slice(eqIdx + 1).trim();
      const value = raw.replace(/^"([\s\S]*)"$/, '$1').replace(/^'([\s\S]*)'$/, '$1');
      if (!(key in process.env)) process.env[key] = value;
    }
    console.log(`[loadEnv] Loaded: ${envFile}`);
    break;
  }
}
