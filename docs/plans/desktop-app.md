# Plan: CandidAI Desktop App — Stealth Bulk Email Sender

## Overview
A cross-platform Electron desktop application (Windows & macOS) that lets CandidAI users send their generated job-application emails in bulk without any API keys or app passwords. The app authenticates against the existing CandidAI website, reads unsent emails directly from Firebase Firestore, and delivers them by automating the user's webmail UI (Gmail, Outlook, Yahoo) via Puppeteer stealth — simulating human behaviour to avoid spam detection.

**Folder:** `desktop/` (root of the monorepo, sibling of `site/` and `server/`)

## Tech Stack
- **Framework:** Electron.js (Main + Renderer processes)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + lucide-react + shardcn ui
- **Automation:** `puppeteer-core`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`
- **Firebase SDK:** `firebase` (client) — same Firebase project as the web app
- **IPC:** `contextBridge` + `ipcRenderer` / `ipcMain` via `preload.ts`

## Firebase / Firestore Data Contracts
The desktop app reads from and writes to the **same** Firestore project used by the web app.

| Collection path | Relevant fields |
|---|---|
| `users/{uid}/data/emails` | Keys = `unique_id`. Values: `subject`, `body`, `email_address`, `cv_url` |
| `users/{uid}/data/results` | Keys = `unique_id`. Values: `email_sent` (Timestamp — epoch `1970-01-01` = unsent), `company.name`, `recruiter.name`, `recruiter.job_title` |

**Determining unsent emails:** `email_sent` is a Firestore Timestamp. An email is considered *unsent* when `email_sent.toMillis() === new Date('1970-01-01').getTime()` (i.e., value equals epoch zero).

**Marking as sent:** After a successful send, update `users/{uid}/data/results` → `{ [unique_id]: { email_sent: Timestamp.now() } }`.

## Validation Commands
- `npm run dev` — start Electron in dev mode (Vite + Electron concurrently)
- `npm run build` — compile TypeScript, bundle with Vite, package with electron-builder
- `npm run lint` — ESLint check

---

## Task 1: Project Scaffold
- [ ] Create the folder `desktop/` at the repo root.
- [ ] Inside `desktop/`, run `npm init -y` and set `"main": "dist-electron/main.js"` in `package.json`.
- [ ] Install dependencies:
  ```
  npm install electron react react-dom typescript tailwindcss lucide-react firebase puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth
  npm install -D vite @vitejs/plugin-react electron-builder concurrently wait-on @types/react @types/react-dom @types/node
  ```
- [ ] Create `desktop/vite.config.ts`:
  ```typescript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  export default defineConfig({
    plugins: [react()],
    base: './',
    build: { outDir: 'dist-renderer' }
  });
  ```
- [ ] Create `desktop/tsconfig.json` targeting ES2020, with `"moduleResolution": "bundler"` and paths covering `src/` and `electron/`.
- [ ] Create `tailwind.config.js` with `content: ['./src/**/*.{ts,tsx}']`.
- [ ] Add `package.json` scripts:
  ```json
  "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "build": "vite build && tsc -p tsconfig.electron.json && electron-builder",
  "lint": "eslint src electron --ext .ts,.tsx"
  ```
- [ ] Mark completed.

---

## Task 2: Electron Main Process & IPC Skeleton (`electron/main.ts`)
- [ ] Create `desktop/electron/main.ts`.
- [ ] In `app.whenReady()`, create the main `BrowserWindow` with `webPreferences: { preload, contextIsolation: true, nodeIntegration: false }`.
- [ ] Register the custom protocol `candidai://` using `app.setAsDefaultProtocolClient('candidai')`.
- [ ] Handle deep-link token capture:
  - On **macOS**: listen to `app.on('open-url', (_, url) => ...)`.
  - On **Windows**: parse `process.argv` on `app.on('second-instance', ...)`.
  - Extract the JWT token from `candidai://auth?token=XYZ` and send it to the renderer via `mainWindow.webContents.send('auth-success', token)`.
- [ ] Register all IPC handlers (stubs — to be implemented in later tasks):
  - `ipcMain.handle('connect-provider', ...)`
  - `ipcMain.handle('disconnect-provider', ...)`
  - `ipcMain.handle('get-provider-status', ...)`
  - `ipcMain.handle('start-campaign', ...)`
  - `ipcMain.handle('stop-campaign', ...)`
- [ ] Mark completed.

---

## Task 3: Preload & Context Bridge (`electron/preload.ts`)
- [ ] Create `desktop/electron/preload.ts`.
- [ ] Expose a typed `window.electronAPI` object via `contextBridge.exposeInMainWorld`:
  ```typescript
  window.electronAPI = {
    onAuthSuccess: (cb: (token: string) => void) => ipcRenderer.on('auth-success', (_, t) => cb(t)),
    openExternalLogin: () => ipcRenderer.invoke('open-external-login'),
    connectProvider: (provider: 'gmail' | 'outlook' | 'yahoo') => ipcRenderer.invoke('connect-provider', provider),
    disconnectProvider: (provider: string) => ipcRenderer.invoke('disconnect-provider', provider),
    getProviderStatus: (provider: string) => ipcRenderer.invoke('get-provider-status', provider),
    startCampaign: (payload: CampaignPayload) => ipcRenderer.invoke('start-campaign', payload),
    stopCampaign: () => ipcRenderer.invoke('stop-campaign'),
    onCampaignProgress: (cb: (p: ProgressPayload) => void) => ipcRenderer.on('campaign-progress', (_, p) => cb(p)),
    onCampaignError: (cb: (msg: string) => void) => ipcRenderer.on('campaign-error', (_, m) => cb(m)),
  };
  ```
- [ ] Create `desktop/src/electron.d.ts` with the matching TypeScript interface so the Renderer has full type-safety.
- [ ] Mark completed.

---

## Task 4: Firebase Client Initialisation (`src/lib/firebase.ts`)
- [ ] Create `desktop/src/lib/firebase.ts`.
- [ ] Initialise the Firebase app using the **same** project credentials as the web app (`.env.local` in the **repo root** — copy the relevant `VITE_FIREBASE_*` vars to `desktop/.env`):
  ```
  VITE_FIREBASE_API_KEY=...
  VITE_FIREBASE_AUTH_DOMAIN=...
  VITE_FIREBASE_PROJECT_ID=...
  VITE_FIREBASE_APP_ID=...
  ```
- [ ] Export `db` (Firestore instance) and `auth` (Firebase Auth instance).
- [ ] Export a helper `signInWithCustomToken(token: string)` that calls `firebase/auth signInWithCustomToken` — the desktop deep-link delivers a Firebase custom token minted by the CandidAI backend.
- [ ] Mark completed.

---

## Task 5: Firestore Data Layer (`src/lib/firestore.ts`)
- [ ] Create `desktop/src/lib/firestore.ts`.
- [ ] Implement `getUnsentEmails(uid: string): Promise<EmailItem[]>`:
  - Read `users/{uid}/data/emails` (single document, keys = `unique_id`).
  - Read `users/{uid}/data/results` (single document, keys = `unique_id`).
  - Join on `unique_id`: keep only entries where `results[id].email_sent` is epoch (`1970-01-01`).
  - Return array of `EmailItem`:
    ```typescript
    interface EmailItem {
      id: string;          // unique_id
      to: string;          // email_address
      subject: string;
      body: string;
      cvUrl: string;       // cv_url
      companyName: string; // results[id].company.name
      recruiterName: string;
      recruiterTitle: string;
    }
    ```
- [ ] Implement `getAllEmails(uid: string): Promise<EmailItem[]>` — same join but without the epoch filter (for the "all emails" view).
- [ ] Implement `updateEmailSent(uid: string, uniqueId: string, sent: boolean): Promise<void>`:
  - If `sent === true`: set `users/{uid}/data/results → { [uniqueId]: { email_sent: serverTimestamp() } }` (merge).
  - If `sent === false`: set `email_sent` back to epoch Timestamp (`Timestamp.fromDate(new Date('1970-01-01'))`).
- [ ] Implement `updateEmailContent(uid: string, uniqueId: string, patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>): Promise<void>` — updates `users/{uid}/data/emails → { [uniqueId]: patch }` with merge.
- [ ] Mark completed.

---

## Task 6: Application Authentication Flow (React + Deep Link)
- [ ] Create `desktop/src/App.tsx` as the root component with a simple router: `<LoginScreen>` when no auth token, `<Dashboard>` when authenticated.
- [ ] In `LoginScreen`:
  - Show the CandidAI logo and a "Login with CandidAI" button.
  - On click: call `window.electronAPI.openExternalLogin()`.
  - The Main process handler for `open-external-login` calls `shell.openExternal('https://candidai.tech/desktop-login')`.
  - Listen to `window.electronAPI.onAuthSuccess(token => ...)`.
  - On token received: call `signInWithCustomToken(token)` → on success, transition to `<Dashboard>`.
- [ ] Persist the Firebase auth state across restarts using `onAuthStateChanged` in `src/lib/firebase.ts` — if the user is already signed in on launch, skip `LoginScreen`.
- [ ] Mark completed.

---

## Task 7: Dashboard UI (`src/components/Dashboard.tsx`)
The dashboard is the main screen shown after authentication. It is divided into two tabs: **Pending** (unsent) and **All Emails**.

- [ ] Create `desktop/src/components/Dashboard.tsx`.
- [ ] On mount, call `getUnsentEmails(uid)` and store results in state.
- [ ] Render a table/list of emails with columns: Company, Recruiter, To, Subject (truncated), Status badge (Pending / Sent).
- [ ] Add a toolbar with:
  - **Provider selector** — dropdown: Gmail / Outlook / Yahoo, with a "Connect" button per provider. Connection state (connected / disconnected) shown as a coloured dot.
  - **"Send All Pending"** button — disabled until a provider is connected.
  - **Progress bar** — appears during an active campaign (listens to `onCampaignProgress`).
- [ ] Each row has:
  - **Edit** icon (opens `EmailEditModal`).
  - **Send** icon (sends this single email immediately).
  - **CV chip** — shows the attached CV filename; clicking opens a file picker to attach a different CV for this email.
- [ ] Mark completed.

---

## Task 8: Email Edit Modal (`src/components/EmailEditModal.tsx`)
- [ ] Create `desktop/src/components/EmailEditModal.tsx`.
- [ ] Fields: `To` (email address), `Subject` (text input), `Body` (textarea with monospace font for easy editing).
- [ ] "Save" button calls `updateEmailContent(uid, id, patch)` and updates local state optimistically.
- [ ] "Send Now" button calls `window.electronAPI.startCampaign({ emails: [thisEmail], provider })` immediately after saving.
- [ ] Mark completed.

---

## Task 9: Provider Connection Engine (`electron/providers/connect.ts`)
- [ ] Create `desktop/electron/providers/connect.ts`.
- [ ] Implement `connectProvider(provider: 'gmail' | 'outlook' | 'yahoo'): Promise<'connected' | 'error'>`:
  - Determine the `userDataDir` path: `app.getPath('userData') + '/sessions/' + provider`.
  - Determine the login URL:
    - `gmail` → `https://mail.google.com`
    - `outlook` → `https://outlook.live.com`
    - `yahoo` → `https://mail.yahoo.com`
  - Launch Puppeteer with `headless: false`, `userDataDir`, and `puppeteer-extra-plugin-stealth`.
  - Navigate to the login URL.
  - Poll `page.url()` every 2 seconds. When the URL includes the provider's inbox indicator (Gmail: `/mail/u/`, Outlook: `/mail/`, Yahoo: `/d/folders/1`), the user is logged in.
  - Call `browser.close()` and return `'connected'`.
  - Wrap everything in try/catch; on error return `'error'`.
- [ ] Implement `getProviderStatus(provider: string): boolean` — checks if `userDataDir` exists and is non-empty (cookies saved). Returns true if directory exists with at least one `Cookies` file.
- [ ] Implement `disconnectProvider(provider: string): Promise<void>` — deletes `userDataDir` using `fs.rmSync(path, { recursive: true })`.
- [ ] Register these as IPC handlers in `main.ts` (replacing the stubs from Task 2).
- [ ] Mark completed.

---

## Task 10: Background Sending Engine (`electron/engine/sender.ts`)
This is the core of the application. It runs entirely in the Main process.

- [ ] Create `desktop/electron/engine/sender.ts`.
- [ ] Export `runCampaign(emails: EmailItem[], provider: string, mainWindow: BrowserWindow): Promise<void>`:
  - Launch Puppeteer **headless** (`headless: "new"`), `userDataDir` (same as connect step — session already saved), stealth plugin.
  - Navigate to the provider's inbox URL.
  - **For Gmail:**
    - Press `c` keyboard shortcut to open Compose (more reliable than clicking the button).
    - Fill `To`: `await page.type('[name="to"]', email.to, { delay: 30 })`.
    - Fill `Subject`: `await page.type('[name="subjectbox"]', email.subject, { delay: 30 })`.
    - Fill `Body`: click the editable div (`div[aria-label="Message Body"]`), then type with `{ delay: 30 }`.
    - If `email.cvUrl` is set, download the CV to a temp file and attach via the Gmail file input.
    - Click Send via `[aria-label="Send"]`.
  - **For Outlook:**
    - Click compose via `[aria-label="New message"]` or `[aria-label="New Mail"]`.
    - Fill `To` input: `input[aria-label="To"]`.
    - Fill `Subject`: `input[aria-label="Subject"]`.
    - Fill `Body`: `div[aria-label="Message body"]`.
    - Click send: `[aria-label="Send"]`.
  - **For Yahoo:**
    - Click compose via `[data-test-id="compose-button"]` or `::-p-text(Compose)`.
    - Fill fields using ARIA labels.
    - Click `[data-test-id="send-button"]`.
  - After each send:
    - Call the `updateEmailSent` Firestore helper (import via a thin IPC round-trip or inject as a callback).
    - Emit progress: `mainWindow.webContents.send('campaign-progress', { sent: i + 1, total: emails.length })`.
    - Wait random delay: `await delay(randomBetween(30_000, 60_000))`.
  - On selector timeout or any puppeteer error: catch, close browser, emit `mainWindow.webContents.send('campaign-error', 'Connection lost or UI changed. Please reconnect your provider.')`, and return.
- [ ] Add a `stopCampaign()` escape hatch (set a `shouldStop` flag checked at the top of each loop iteration).
- [ ] Register `start-campaign` and `stop-campaign` IPC handlers in `main.ts`.
- [ ] Mark completed.

---

## Task 11: Anti-Detection Utilities (`electron/engine/humanize.ts`)
- [ ] Create `desktop/electron/engine/humanize.ts`.
- [ ] Export `randomBetween(min: number, max: number): number`.
- [ ] Export `delay(ms: number): Promise<void>` — wraps `setTimeout`.
- [ ] Export `humanType(page: Page, selector: string, text: string): Promise<void>`:
  - Always uses `page.type(selector, text, { delay: 30 })`. Never `page.fill()` or `page.evaluate`.
- [ ] Mark completed.

---

## Task 12: CV Attachment Helper (`electron/engine/attachCV.ts`)
- [ ] Create `desktop/electron/engine/attachCV.ts`.
- [ ] Export `attachCV(page: Page, cvUrl: string, provider: 'gmail' | 'outlook' | 'yahoo'): Promise<void>`:
  - Download the file from `cvUrl` (which is a Firebase Storage URL) into `os.tmpdir()` using Node's `https.get`.
  - For Gmail: locate the hidden file input under the attach icon and call `inputEl.uploadFile(tmpPath)`.
  - For Outlook/Yahoo: click the attach button, wait for a file dialog, and use Electron's `dialog.showOpenDialog` workaround — or trigger the hidden `<input type="file">` directly.
  - After upload, wait for the attachment chip to appear before proceeding.
- [ ] Mark completed.

---

## Task 13: CandidAI Backend — Desktop Login Endpoint
The website must mint a Firebase custom token when the user visits `/desktop-login` and redirect back to the Electron app.

- [ ] Open `site/src/app/desktop-login/page.tsx`. Create it as a Server Component.
- [ ] The page requires the user to already be authenticated (Firebase session cookie).
- [ ] Call Firebase Admin SDK: `admin.auth().createCustomToken(uid)` to mint a short-lived token.
- [ ] Redirect to `candidai://auth?token=<customToken>` using `redirect()`.
- [ ] If the user is not authenticated, redirect to `/login?next=/desktop-login`.
- [ ] Mark completed.

---

## Task 14: Packaging & Distribution (`electron-builder`)
- [ ] Create `desktop/electron-builder.config.js`:
  ```js
  module.exports = {
    appId: 'tech.candidai.desktop',
    productName: 'CandidAI',
    directories: { output: 'release' },
    protocols: [{ name: 'CandidAI', schemes: ['candidai'] }],
    mac: { target: 'dmg', icon: 'assets/icon.icns' },
    win: { target: 'nsis', icon: 'assets/icon.ico' },
    files: ['dist-renderer/**', 'dist-electron/**', 'package.json'],
  };
  ```
- [ ] Add `assets/icon.icns` and `assets/icon.ico` (convert from `site/public/logo.png`).
- [ ] Ensure `app.setAsDefaultProtocolClient('candidai')` is called in `main.ts` only when not in dev (use `app.isPackaged`).
- [ ] Add `"build": "npm run build && electron-builder"` to `package.json` scripts.
- [ ] Mark completed.

---

## Task 15: End-to-End Smoke Test (Manual Checklist)
- [ ] `npm run dev` starts without errors; Electron window appears.
- [ ] "Login with CandidAI" opens the browser to `candidai.tech/desktop-login`.
- [ ] After login, the app receives `candidai://auth?token=...` and signs in; Dashboard is shown.
- [ ] Unsent emails load from Firestore and are listed correctly.
- [ ] "Connect Gmail" opens a visible Chrome window; after manual login the status dot turns green.
- [ ] Editing an email and saving updates Firestore.
- [ ] "Send All Pending" triggers the headless automation; progress bar advances; after each send, the row moves out of the Pending tab.
- [ ] Stopping mid-campaign halts the loop without crashing.
- [ ] Disconnecting a provider deletes the session folder.
- [ ] Mark completed.
