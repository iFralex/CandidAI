import * as fs from 'fs';
import * as path from 'path';

function findBundledChromiumPath(): string | null {
  const platformFolder = process.platform === 'darwin'
    ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64')
    : process.platform === 'win32' ? 'win'
    : 'linux';

  const browsersDirs: string[] = [];

  // Packaged app: electron-builder copies browsers/<platform>/ → Resources/browsers/
  if (process.resourcesPath) {
    browsersDirs.push(path.join(process.resourcesPath, 'browsers'));
  }
  // Dev mode: compiled to dist-electron/utils/, go up to project root
  browsersDirs.push(path.join(__dirname, '../../../browsers', platformFolder));
  browsersDirs.push(path.join(__dirname, '../../../../browsers', platformFolder));

  for (const browsersDir of browsersDirs) {
    if (!fs.existsSync(browsersDir)) continue;

    let execPath: string;
    if (process.platform === 'darwin') {
      const macArch = process.arch === 'arm64' ? 'arm64' : 'x64';
      execPath = path.join(browsersDir, `chrome-mac-${macArch}`, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    } else if (process.platform === 'win32') {
      execPath = path.join(browsersDir, 'chrome-win64', 'chrome.exe');
    } else {
      execPath = path.join(browsersDir, 'chrome-linux64', 'chrome');
    }

    if (fs.existsSync(execPath)) return execPath;
  }
  return null;
}

/** Returns the path to the Chrome/Chromium executable, or null if not found. */
export function findChromePath(): string | null {
  const bundled = findBundledChromiumPath();
  if (bundled) {
    console.log(`[chrome] Using bundled Chromium at: ${bundled}`);
    return bundled;
  }

  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    );
  } else if (process.platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
