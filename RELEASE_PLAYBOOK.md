# LifeLog v1.0 Production Release: Master Playbook & Runbook

> **Author:** Krish Patel  
> **Private Source Repo:** `https://github.com/Krrish1411/Lifelog`  
> **Public Releases & Downloads Repo:** `https://github.com/Krrish1411/Lifelog-Releases`  
> **Official Support & Feedback:** `getlifelog@proton.me`

This runbook provides the exact, step-by-step procedures to compile, package, verify, and publish official production binaries for Windows, macOS, Linux, and Android.

---

## 1. Two-Repository Architecture

| Repository | Visibility | Contents & Purpose |
|---|---|---|
| **`Krrish1411/Lifelog`** | **PRIVATE** | 100% of proprietary source code, engines, and internal CI workflows. Kept strictly private. |
| **`Krrish1411/Lifelog-Releases`** | **PUBLIC** | Pre-built binaries (`.exe`, `.dmg`, `.AppImage`, `.apk`), release notes, checksums, public bug tracker, and `version.json`. |

---

## 2. Pre-Flight Verification Checklist

Before compiling release artifacts, execute the following commands in the root of the private repository:

```bash
# 1. Verify TypeScript types compile cleanly with 0 errors
npm run typecheck

# 2. Verify Vite production bundle builds successfully
npm run build

# 3. Check Git status (ensure no unwanted temporary files)
git status
```

Verify that `src/types.ts` contains the exact target release version:
```ts
export const APP_VERSION = "1.0.0";
```

Verify that `public/version.json` matches:
```json
{
  "version": "1.0.0",
  "releaseDate": "2026-09-14",
  "changelog": [
    "Production Release v1.0.0 Sovereign Edition",
    "Native SQLite WAL storage engine for Desktop and WebAssembly for Web/Android",
    "Encrypted second brain notes with dynamic @/#/[ mentions",
    "Visual time-grid calendar with drag-to-tray unblocking",
    "Lag-free executive PDF summary export",
    "Pure local peer-to-peer DTLS device sync"
  ]
}
```

---

## 3. Compiling Desktop Binaries (Electron)

### Option A: Automated CI Builds (Recommended)
The repository includes `.github/workflows/build-electron.yml` configured for multi-platform builds.
1. Push your changes to `main`.
2. Push a release tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions builds Ubuntu Linux, Windows, and macOS binaries in parallel and uploads the artifacts.

### Option B: Local Compilation

#### Linux (`.AppImage` & `.deb`):
```bash
npm run electron:build:linux
```
*Output location:* `dist_electron/LifeLog-1.0.0.AppImage`

#### Windows (`.exe` Installer & Portable):
```bash
npm run electron:build:win
```
*Output location:* `dist_electron/LifeLog Setup 1.0.0.exe` and `dist_electron/LifeLog 1.0.0.exe` (portable)

#### macOS (`.dmg` Universal):
```bash
npm run electron:build:mac
```
*Output location:* `dist_electron/LifeLog-1.0.0.dmg`

---

## 4. Compiling Android Release APK

LifeLog uses Capacitor to package native Android APKs.

```bash
# 1. Build the production web bundle
npm run build

# 2. Sync web assets and plugins to Android project
npx cap sync android

# 3. Navigate to Android project directory
cd android

# 4. Assemble release APK
./gradlew assembleRelease
```

*Output location:*  
`android/app/build/outputs/apk/release/app-release-unsigned.apk` (or signed if keystore configured).

Rename the APK for release:
```bash
cp app/build/outputs/apk/release/app-release.apk ../dist_electron/LifeLog-1.0.0.apk
```

---

## 5. Generating SHA-256 Checksums

Always generate cryptographic checksums so users can verify binary integrity:

```bash
cd dist_electron

# Generate SHA256 sums for all release binaries
sha256sum LifeLog-Setup-1.0.0.exe LifeLog-1.0.0.dmg LifeLog-1.0.0.AppImage LifeLog-1.0.0.apk > SHA256SUMS.txt

# Inspect generated checksums
cat SHA256SUMS.txt
```

---

## 6. Publishing to `Lifelog-Releases` Public Repository

### Step 1: Update `version.json` in Public Repo
In the public `Lifelog-Releases` repo on the `main` branch, ensure `version.json` at the root matches:

```json
{
  "version": "1.0.0",
  "releaseDate": "2026-09-14",
  "changelog": [
    "Production Release v1.0.0 Sovereign Edition",
    "Native SQLite WAL engine with sub-5ms cold boots",
    "Zero-cloud peer-to-peer WebRTC DTLS sync",
    "Encrypted second brain notes with dynamic @/#/[ mentions",
    "Drag-to-tray calendar unblocking and habit scheduling",
    "Zero-lag executive PDF export with customizable task bundling"
  ],
  "downloads": {
    "windows": "https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-Setup-1.0.0.exe",
    "windowsPortable": "https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0-portable.exe",
    "mac": "https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.dmg",
    "linux": "https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.AppImage",
    "android": "https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.apk"
  }
}
```

Commit and push `version.json`:
```bash
git add version.json
git commit -m "chore(release): update version.json to v1.0.0"
git push origin main
```

### Step 2: Create the GitHub Release
1. Navigate to: `https://github.com/Krrish1411/Lifelog-Releases/releases/new`
2. **Tag version:** `v1.0.0`
3. **Release title:** `LifeLog v1.0.0 — Sovereign Edition`
4. **Description:**
   ```markdown
   # LifeLog v1.0.0 — Sovereign Edition

   Welcome to the official production release of LifeLog, the sovereign personal operating system designed by Krish Patel.

   ### ✨ Highlights
   - **Zero Cloud & Zero Telemetry:** 100% private, offline-first execution.
   - **Native SQLite WAL Engine:** Instantaneous sub-5ms boots and ACID transactions.
   - **Encrypted Second Brain:** Markdown notes with dynamic `@`, `#`, `[` mentions and AES-256 encryption.
   - **Visual Time Blocking:** Interactive 24h calendar grid with drag-and-drop task & habit scheduling.
   - **Deep Focus Studio:** Pomodoro, Countdown, and Flow timers with ambient audio and pause auditing.
   - **P2P DTLS Sync:** Direct local Wi-Fi synchronization with zero central cloud servers.

   ### 📦 Binaries & SHA-256 Checksums
   Please verify checksums against `SHA256SUMS.txt` after downloading.
   ```
5. **Attach Binary Assets:**
   - `LifeLog-Setup-1.0.0.exe` (Windows Installer)
   - `LifeLog-1.0.0-portable.exe` (Windows Portable)
   - `LifeLog-1.0.0.dmg` (macOS Universal)
   - `LifeLog-1.0.0.AppImage` (Linux Universal)
   - `LifeLog-1.0.0.apk` (Android APK)
   - `SHA256SUMS.txt` (Integrity Checksums)
6. Click **Publish release**.

---

## 7. Post-Release Verification

1. Open LifeLog Desktop or Web.
2. Go to **Settings > General > Software Updates & Releases**.
3. Tap **Check for Updates**.
4. Confirm the response:
   - Green pill: `"You are running the latest sovereign build (v1.0.0). Zero updates pending."`
5. Test the **Direct Developer Support** button:
   - Opens `mailto:getlifelog@proton.me` with diagnostic headers.
6. Test the **GitHub Public Issue Tracker** button:
   - Opens `https://github.com/Krrish1411/Lifelog-Releases/issues`.

---
*Runbook verified for LifeLog v1.0.0 Production Release.*
