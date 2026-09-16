---
name: webapp-to-electron
description: >-
  Comprehensive production runbook for converting any Web/React/Vite/TypeScript application
  into a high-performance desktop Electron app (Windows, Linux, macOS) and cross-platform
  native ecosystem (Android APK + Web PWA). Covers RAM/GPU performance optimization,
  native SQLite WAL storage, encrypted dual-layer persistence, in-app smart update delivery,
  zero-bandwidth CI/CD release pipelines, responsive mobile UI adaptation, welcome onboarding,
  monetization, and release documentation.
---

# WebApp-to-Electron Master Production Skill

This skill provides an end-to-end, battle-tested production runbook for taking any modern web application (React, TypeScript, Vite, Tailwind CSS) and converting it into a sovereign, high-performance desktop application with Electron, integrated SQLite WAL storage, smart in-app updates, cross-platform CI/CD release engineering, and native mobile parity.

---

## Table of Contents
1. [Core Architecture & Project Structure](#1-core-architecture--project-structure)
2. [Performance, RAM & GPU Optimization](#2-performance-ram--gpu-optimization)
3. [Storage Engine: Native SQLite WAL + Dual-Layer Fallback](#3-storage-engine-native-sqlite-wal--dual-layer-fallback)
4. [Smart In-App Updates & Version Sync Engine](#4-smart-in-app-updates--version-sync-engine)
5. [UI Ergonomics, Welcome Page & Monetization](#5-ui-ergonomics-welcome-page--monetization)
6. [CI/CD Cloud Release Engineering (Zero Local Bandwidth)](#6-cicd-cloud-release-engineering-zero-local-bandwidth)
7. [Documentation, Licensing & Release Hub Standards](#7-documentation-licensing--release-hub-standards)

---

## 1. Core Architecture & Project Structure

### Recommended Directory Layout
```
my-app/
├── electron/
│   ├── main.cjs         # Main process (window lifecycle, security, IPC handlers)
│   ├── preload.cjs      # Isolated contextBridge bridge
│   ├── db.cjs           # Native SQLite WAL database manager (node:sqlite)
│   └── icons/           # App icons (.png, .ico, .icns)
├── src/
│   ├── db/              # Unified database access layer (Electron SQLite + Web SQLite/IDB)
│   ├── utils/
│   │   ├── native.ts    # Platform & distribution auto-detection
│   │   ├── updater.ts   # In-app update checker & remote descriptor fetcher
│   │   └── crypto.ts    # Hardware device-bound AES-256-GCM encryption
│   └── components/
│       └── UpdateModal.tsx # Targeted single-binary update prompt
├── .github/
│   └── workflows/
│       ├── build-electron.yml # Cloud desktop builds (Win, Mac, Linux)
│       └── build-apk.yml      # Cloud Android APK build
├── package.json
├── RELEASE.md           # Master changelog & version history
├── LICENSE              # Permissive MIT License
└── vite.config.ts
```

### `package.json` Configuration
Set `main` to `electron/main.cjs` and configure build scripts and `electron-builder`:
```json
{
  "name": "my-app",
  "productName": "MyApp",
  "version": "1.0.0",
  "main": "electron/main.cjs",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "cross-env NODE_ENV=development electron electron/main.cjs",
    "electron:build": "vite build && electron-builder",
    "electron:build:linux": "vite build && electron-builder --linux",
    "electron:build:win": "vite build && electron-builder --win",
    "electron:build:mac": "vite build && electron-builder --mac"
  },
  "build": {
    "appId": "com.myapp.desktop",
    "productName": "MyApp",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "artifactName": "${productName}-${target === 'nsis' ? 'Windows-Setup' : 'Windows-Portable'}.${ext}"
    },
    "linux": {
      "target": ["AppImage", "deb", "tar.gz"],
      "category": "Utility",
      "artifactName": "${productName}-Linux-${arch}.${ext}"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.productivity",
      "artifactName": "${productName}-macOS.${ext}"
    }
  }
}
```

### Vite Configuration (`vite.config.ts`)
Must use relative base `./` so assets load properly via file protocol in packaged Electron:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

---

## 2. Performance, RAM & GPU Optimization

Desktop web wrappers often suffer from memory bloat and CPU background drain. Apply these critical runtime optimizations in `electron/main.cjs`:

### A. Memory Trimming on Minimize & Blur
Purge Chromium's unused render and GPU caches when the user minimizes or tabs away from the window:
```javascript
const trimMemory = () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearCache().catch(() => {});
    }
  } catch {}
};

mainWindow.on('blur', trimMemory);
mainWindow.on('minimize', trimMemory);
```

### B. Background Throttling & Spellcheck Disabling
Prevent timer and background tasks from eating CPU while inactive, and disable Chromium's heavy multi-language spellcheck dictionary threads:
```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  backgroundThrottling: true, // Throttles animations/timers when hidden
  spellcheck: false,          // Saves ~40-60 MB of RAM on startup
  devTools: isDev,
}
```

### C. Anti-Theft & Production Locking
Prevent users or third-party extensions from opening DevTools or viewing source in production:
```javascript
if (!isDev) {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && ['i', 'j'].includes(input.key.toLowerCase())) ||
      ((input.control || input.meta) && input.key.toLowerCase() === 'u')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });
}
```

### D. Floating Mini-Windows (Popout Widgets)
Support lightweight companion windows (e.g. Always-on-top timer or floating scratchpad):
```javascript
function createPopoutWindow() {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.show();
    popoutWindow.focus();
    return;
  }

  popoutWindow = new BrowserWindow({
    title: 'Floating Widget',
    width: 360,
    height: 480,
    minWidth: 300,
    minHeight: 380,
    backgroundColor: '#07090e',
    alwaysOnTop: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });

  const url = isDev && process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#widget`
    : `file://${path.join(__dirname, '../dist/index.html')}#widget`;

  popoutWindow.loadURL(url);
}
```

---

## 3. Storage Engine: Native SQLite WAL + Dual-Layer Fallback

Never rely on raw JSON files or unindexed storage for desktop apps. Use Node 22's built-in `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (WAL).

### A. High-Performance SQLite Tuning (`electron/db.cjs`)
```javascript
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function initDatabase(dbPath) {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  dbInstance = new DatabaseSync(dbPath);

  // Critical SQLite Pragmas for High Performance & ACID Crash-Immunity
  dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  // Create Schema with Row-Level Encryption
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      category TEXT,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted_payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_updated ON records(updated_at);
  `);

  return dbInstance;
}
```

### B. Dual-Layer Persistence (SQLite Primary + JSON Safety Snapshot)
In your front-end store:
1. **Primary Write**: Save row-by-row into SQLite WAL (`app.sqlite3` / `app.sqlite3-wal`).
2. **Passive Fallback**: Write a single serialized encrypted snapshot (`app-vault.json`).
3. **Disaster Recovery**: On boot, if SQLite is ever missing or corrupted, the bootloader automatically restores state from the JSON fallback file.

### C. OS Storage Path Resolution
In `electron/main.cjs`:
```javascript
function getStoragePaths() {
  // Respect portable mode if running as portable executable
  const userData = process.env.PORTABLE_EXECUTABLE_DIR 
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
    : app.getPath('userData'); // ~/.config/AppName on Linux, %APPDATA%/AppName on Windows

  const attachmentsDir = path.join(userData, 'attachments');
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(attachmentsDir, { recursive: true });

  return {
    dir: userData,
    file: path.join(userData, 'app-vault.json'),
    sqliteFile: path.join(userData, 'app.sqlite3'),
    attachmentsDir,
  };
}

// IPC: Let users open their local storage directory in 1 click
ipcMain.handle('app:open-storage-folder', async () => {
  const { dir } = getStoragePaths();
  await shell.openPath(dir);
  return true;
});
```

---

## 4. Smart In-App Updates & Version Sync Engine

Users should never be forced to search through multi-platform download releases. The application should automatically detect what platform the user is on and provide a single-click update.

### A. The Canonical `version.json` Schema
Host `version.json` at the root of your public releases repo or GitHub Pages:
```json
{
  "version": "1.1.1",
  "releaseDate": "2026-09-15",
  "minRequiredVersion": "1.0.0",
  "changelog": [
    "Smart Platform-Filtered Updates: App detects current OS and provides single matching binary",
    "Automated Daily Update Check: Silently checks once every 24h on launch",
    "Universal Touch Architecture: Fluid scrolling across all cards on mobile"
  ],
  "downloads": {
    "windows": "https://github.com/USER/REPO-Releases/releases/latest/download/App-Windows-Setup.exe",
    "windowsPortable": "https://github.com/USER/REPO-Releases/releases/latest/download/App-Windows-Portable.exe",
    "mac": "https://github.com/USER/REPO-Releases/releases/latest/download/App-macOS.dmg",
    "linux": "https://github.com/USER/REPO-Releases/releases/latest/download/App-Linux-x86_64.AppImage",
    "linuxDeb": "https://github.com/USER/REPO-Releases/releases/latest/download/App-Linux-amd64.deb",
    "android": "https://github.com/USER/REPO-Releases/releases/latest/download/App-Android.apk"
  }
}
```

### B. Eliminating the CORS Preflight Trap
**The Bug:** Sending `headers: { "Cache-Control": "no-cache" }` triggers an HTTP `OPTIONS` preflight request. GitHub `raw.githubusercontent.com` returns **HTTP 403** on `OPTIONS`, breaking all in-app update checks on Android WebView and web browsers!

**The Solution (`src/utils/updater.ts`):**
1. **On Native Android / iOS:** Use `CapacitorHttp.get(...)` which executes via native Java (`HttpURLConnection`), bypassing Chromium WebView CORS completely.
2. **On Web / Electron:** Use simple `fetch()` with timestamp query parameter cache busting (`?_t=${Date.now()}`) and **zero custom headers**.
3. Use independent `AbortController` timeouts for primary and fallback URLs:

```typescript
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export async function fetchRemoteVersionInfo(): Promise<AppVersionInfo> {
  const ts = Date.now();
  const primaryUrl = `${REMOTE_URL}?_t=${ts}`;
  const fallbackUrl = `${FALLBACK_URL}?_t=${ts}`;

  // 1. Native mobile bypass
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({ url: primaryUrl, connectTimeout: 8000, readTimeout: 8000 });
      if (res.status === 200 && res.data) {
        return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      }
    } catch {}
  }

  // 2. Simple fetch without custom headers (prevents CORS 403 preflight)
  const fetchSafe = async (url: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await fetchSafe(primaryUrl);
  } catch {
    return await fetchSafe(fallbackUrl);
  }
}
```

### C. Android APK Stale Cache Trap Fix (`src/main.tsx`)
**The Trap:** If you register a PWA Service Worker (`sw.js`) inside an Android WebView, WebView permanently stores cached JS/HTML in `CacheStorage`. When you upgrade your APK in-place, the app keeps loading the old cached code until the user clicks "Clear Data".

**The Fix:**
On native mobile, actively unregister all service workers and wipe all `CacheStorage` on startup:
```typescript
if (typeof window !== "undefined") {
  const isNative = (window as any).Capacitor?.isNativePlatform?.() || navigator.userAgent.includes("wv");

  if (isNative) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister().catch(() => {});
      });
    }
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k).catch(() => {});
      });
    }
  } else if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    // Only register SW for actual Web / PWA
    navigator.serviceWorker.register("./sw.js");
  }
}
```

### D. Smart Platform Detection (`src/utils/native.ts`)
```typescript
export type AppDistribution =
  | "windows-setup"
  | "windows-portable"
  | "linux-appimage"
  | "linux-deb"
  | "mac"
  | "android"
  | "web";

export async function detectDistribution(): Promise<AppDistribution> {
  if (Capacitor.isNativePlatform()) return "android";
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    const info = await (window as any).electronAPI.getStorageInfo?.();
    if (info?.platform === "win32") return info.isPortable ? "windows-portable" : "windows-setup";
    if (info?.platform === "linux") return info.isAppImage ? "linux-appimage" : "linux-deb";
    if (info?.platform === "darwin") return "mac";
  }
  return "web";
}
```

---

## 5. UI Ergonomics, Welcome Page & Monetization

### A. Mobile Phone Viewport Protection (Avoid Horizontal Overflow)
On mobile viewports (<400px wide), rigid horizontal rows cause version badges and action buttons to overflow off-screen.
- Never use rigid `flex items-center justify-between` on multi-item headers.
- Always use `flex flex-col sm:flex-row sm:items-center justify-between gap-3`.
- Add `min-w-0 flex-1` to the text container, `break-words` on subtitles, and `shrink-0` on badges.

### B. Transparent Monetization & Community Trust
If building sovereign, offline-first, or tracker-free software, highlight transparency:
1. **Buy Me a Coffee Badge:** Provide a high-visibility, friendly banner in Settings and README:
   ```html
   <a href="https://buymeacoffee.com/YOUR_HANDLE" target="_blank">
     <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-Support_Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" />
   </a>
   ```
2. **Zero-Telemetry Covenant:** State clearly that zero network packets leave the device on startup.
3. **MIT License Badge:** Display `100% Free & Open Source (MIT)` with a direct link to the source code repository.

---

## 6. CI/CD Cloud Release Engineering (Zero Local Bandwidth)

Never build large Electron or APK binaries on your local laptop. Use GitHub Actions to compile in Microsoft's multi-gigabit cloud and attach binaries directly to GitHub Releases.

### Desktop Electron Workflow (`.github/workflows/build-electron.yml`)
```yaml
name: Build Desktop Apps (Electron)

on:
  push:
    tags: [ "v*" ]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: "desktop-build"
  cancel-in-progress: true

jobs:
  build-linux:
    name: Build Linux Packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - name: Install Linux Build Tools
        run: sudo apt-get update && sudo apt-get install -y libarchive-tools libfuse2 desktop-file-utils || true
      - run: npm install
      - run: npm run build
      - run: npx electron-builder --linux --publish never
      - name: Attach to Release
        uses: softprops/action-gh-release@v2
        with:
          repository: USER/REPO-Releases
          token: ${{ secrets.RELEASES_TOKEN }}
          files: |
            release/*.AppImage
            release/*.deb
            release/*.tar.gz

  build-windows:
    name: Build Windows Packages
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - run: npm install
      - run: npm run build
      - run: npx electron-builder --win --publish never
      - name: Attach to Release
        uses: softprops/action-gh-release@v2
        with:
          repository: USER/REPO-Releases
          token: ${{ secrets.RELEASES_TOKEN }}
          files: |
            release/*.exe

  build-mac:
    name: Build macOS Packages
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - run: npm install
      - run: npm run build
      - run: npx electron-builder --mac --publish never
      - name: Attach to Release
        uses: softprops/action-gh-release@v2
        with:
          repository: USER/REPO-Releases
          token: ${{ secrets.RELEASES_TOKEN }}
          files: |
            release/*.dmg
            release/*.zip
```

### Android APK Workflow (`.github/workflows/build-apk.yml`)
```yaml
name: Build Android APK

on:
  push:
    tags: [ "v*" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - run: npm install
      - run: npm run build
      - run: npx cap sync android
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '21', cache: 'gradle' }
      - run: chmod +x android/gradlew
      - run: |
          cd android
          ./gradlew assembleRelease
          cd ..
          cp android/app/build/outputs/apk/release/*-release.apk MyApp-Android.apk 2>/dev/null || cp android/app/build/outputs/apk/release/*.apk MyApp-Android.apk
      - name: Attach APK to Release
        uses: softprops/action-gh-release@v2
        with:
          repository: USER/REPO-Releases
          token: ${{ secrets.RELEASES_TOKEN }}
          files: MyApp-Android.apk
```

---

## 7. Documentation, Licensing & Release Hub Standards

When publishing an open source app with binary downloads, use a **Dual-Repository Strategy**:
1. **Source Repo (`USER/Project`)**: Hosts the source code, issues, developer quickstart, and build workflows.
2. **Releases Hub (`USER/Project-Releases`)**: Hosts compiled binaries, release tags, checksums, and the live GitHub Pages web client.

### Standard Downloads Table Template for Release README
```markdown
| Platform | Format | Package Type | Direct Download Link |
|---|---|---|---|
| **Windows** | `.exe` | 64-bit Setup Installer | [Download Windows Setup](https://github.com/USER/REPO-Releases/releases/latest/download/App-Windows-Setup.exe) |
| **Windows** | `.exe` | Portable (No Installation) | [Download Windows Portable](https://github.com/USER/REPO-Releases/releases/latest/download/App-Windows-Portable.exe) |
| **Linux** | `.AppImage` | Universal Linux Binary (x86_64) | [Download AppImage](https://github.com/USER/REPO-Releases/releases/latest/download/App-Linux-x86_64.AppImage) |
| **Linux** | `.deb` | Debian / Ubuntu / Mint | [Download DEB](https://github.com/USER/REPO-Releases/releases/latest/download/App-Linux-amd64.deb) |
| **Linux** | `.tar.gz` | Portable Linux Archive | [Download Tarball](https://github.com/USER/REPO-Releases/releases/latest/download/App-Linux-x64.tar.gz) |
| **macOS** | `.dmg` | Universal Disk Image | [Download macOS DMG](https://github.com/USER/REPO-Releases/releases/latest/download/App-macOS.dmg) |
| **macOS** | `.zip` | Portable Zip Archive | [Download macOS ZIP](https://github.com/USER/REPO-Releases/releases/latest/download/App-macOS.zip) |
| **Android** | `.apk` | Signed Release APK | [Download Android APK](https://github.com/USER/REPO-Releases/releases/latest/download/App-Android.apk) |
| **Web** | Web PWA | Zero-Install Client | [Open Web App](https://USER.github.io/REPO-Releases/) |
```

### Essential Linux AppImage Execution Note
Always document that AppImages require executable permission:
```bash
chmod +x App-Linux-x86_64.AppImage
./App-Linux-x86_64.AppImage
```

---

## 8. Summary Checklist for Any WebApp Transfer

1. [ ] **Vite Config**: Set `base: "./"`.
2. [ ] **Electron Preload**: Expose safe IPC endpoints through `contextBridge.exposeInMainWorld`.
3. [ ] **Security**: `contextIsolation: true`, `nodeIntegration: false`, lock DevTools in production.
4. [ ] **Performance**: Clear cache on minimize/blur (`session.clearCache()`), disable spellcheck, throttle background.
5. [ ] **Storage**: Use `node:sqlite` in WAL mode (`PRAGMA journal_mode = WAL`), encrypt payload at rest, and keep a passive JSON snapshot fallback.
6. [ ] **Update Checker**: Query `version.json` with timestamp cache busting (`?_t=...`) and **no custom headers**.
7. [ ] **Android Parity**: Use `CapacitorHttp` to bypass CORS; wipe Service Workers and `CacheStorage` on mobile boot.
8. [ ] **CI/CD**: Configure GitHub Actions to compile all platform targets and attach directly to GitHub Releases.
9. [ ] **Open Source & Support**: Add permissive `LICENSE` (MIT), "Buy Me a Coffee" links, and clean README matrix.
