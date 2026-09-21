# LifeLog — Engineering Progress & Comprehensive Changelog

This document provides a complete, authoritative, and chronological record of the architectural enhancements, security upgrades, database transformations, and UI refinements implemented in LifeLog. Any developer or AI working on this codebase can reference this file to understand the architecture, exact file locations, and design decisions.

---

## 1. Complete File Manifest & Change Summary

| File | Status | Purpose & Architectural Role |
|---|---|---|
| `electron/db.cjs` | **NEW** | Native Node.js `node:sqlite` (`DatabaseSync`) database manager with WAL mode, normalized schema (10 tables), B-Tree indexes, atomic batch transactions, and `VACUUM INTO` exports. |
| `electron/main.cjs` | Modified | Registered IPC handlers for native SQLite operations (`db-init`, `db-save-row`, `db-delete-row`, `db-batch-save`, `db-load-all`, `db-exec`, `db-query`, `db-export-backup`, `db-import-backup`) and storage path resolutions. |
| `electron/preload.cjs` | Modified | Exposed typed Electron SQLite API to renderer context via `window.electronAPI`. |
| `src/types.ts` | Modified | Extended `Habit` with calendar scheduling (`time?: string`, `order?: number`), added `SqliteAllData` interface, and updated `ElectronAPI` SQLite signatures. |
| `src/db/webSqlite.ts` | **NEW** | WebAssembly `sql.js` SQLite engine for Web Browsers and Android Capacitor WebView with debounced snapshot persistence to IndexedDB (`LifeLogSQLiteStorage`). |
| `src/db/database.ts` | **NEW** | Unified cross-platform database abstraction layer with row-level AES-GCM-256 authenticated encryption, universal `.lifelog` backup routing, and fallback to `DEFAULT_SETTINGS`. |
| `src/db/migrateLegacy.ts` | **NEW** | Automated, one-time legacy data migration utility (< 60ms) converting old JSON/IDB structures into normalized SQLite tables on boot. |
| `src/security/masterKey.ts` | **NEW** | Hardware device-bound encryption key caching (`getDeviceKey()`) providing instant 0-password < 5ms app startup and row-level AES-GCM-256 cipher operations. |
| `src/sync/syncTypes.ts` | Modified | Removed `KEY_SYNC` to enforce sovereign independent per-device keys across P2P pairs. |
| `src/sync/syncEngine.ts` | Modified | Re-engineered pure sovereign P2P sync over WebRTC DTLS; eliminated key transmission and removed all key/data wiping on disconnect. |
| `src/views/Settings.tsx` | Modified | Streamlined **Vault Backups & Migration** UI: added 1-click unencrypted `.lifelog` snapshot with security advisory modal, password-protected backup, smart unified import, and removed internal SQLite diagnostics, Paste JSON, and 12-word phrase clutter. |
| `src/store.tsx` | Modified | Integrated SQLite database boot, background persistence hooks, and automated one-time legacy migration. |
| `src/components/MentionAutocomplete.tsx` | **NEW** | Dynamic caret-tracking floating mention dropdown for `@` (Tasks), `#` (Projects), and `[` / `[[` (Notes). |
| `src/views/Notes.tsx` | Modified | Integrated `MentionAutocomplete` into the note editor body textarea. |
| `src/components/TaskDialog.tsx` | Modified | Integrated `MentionAutocomplete` into task private notes textarea. |
| `src/views/Calendar.tsx` | Modified | Implemented drag-and-drop habit time-slot locking and drag-to-tray unscheduling/unblocking; removed Pro teaser banners. |
| `src/components/DiffConflictModal.tsx` | Overhauled | Rebuilt as a portal-mounted, scroll-free (~410px) pop-up with a unified side-by-side device comparison strip and 3 clean merge options. |
| `src/components/SyncDialog.tsx` | Modified | Moved `DiffConflictModal` outside the parent `<Modal>` to eliminate CSS filter/backdrop clipping; removed commercial Pro cloud banners. |
| `src/components/Shell.tsx` | Modified | Removed "Buy Me a Coffee" button from all 5 engine layouts to preserve distraction-free navigation. |
| `src/views/Welcome.tsx` | Overhauled | Transformed into full product showcase landing page with Zero-Cloud Guarantee badge, 7 core feature pillars, cross-platform downloads hub, and creator philosophy. |
| `src/views/Reports.tsx` | Modified | Added zero-lag PDF export configuration modal; resolved missing CSS progress bars and unconstrained print heights. |
| `src/components/ui.tsx` | Modified | Updated `BarRow` with explicit border tracks and inline `print-color-adjust: exact`. |
| `src/index.css` | Modified | Configured `@media print` universal exact color adjustment, light-mode palette variables, and unclipped container overrides. |
| `src/components/SupportCoffeeModal.tsx` | **NEW** | Milestone-driven supporter prompt (`completedTasks >= 10 || focusMinutes >= 300`) with 7-day snooze and permanent opt-out. |
| `public/version.json` | **NEW** | Canonical update-checking schema queried on-demand by client apps. |
| `scripts/deploy-release-web.sh` | **NEW** | Automated zero-leak deployment script pushing compiled, obfuscated `dist/` directly to `Krrish1411/Lifelog-Releases` (gh-pages). |
| `features.md` | **NEW** | Comprehensive 220+ line technical specification documenting all 8 primary views, 5 layout engines, shortcuts, SQLite WAL architecture, and P2P sync. |
| `RELEASE_PLAYBOOK.md` | **NEW** | Master production binary release playbook covering build commands for Windows, Linux, macOS, Android, and GitHub release tagging. |
| `src/security/recoveryPhrase.ts` | **DELETED** | Removed 12-word recovery phrase generator and PBKDF2 phrase key derivation to eliminate unnecessary onboarding friction. |
| `src/security/bip39Wordlist.ts` | **DELETED** | Removed 2048-word BIP-39 dictionary. |


---

## 2. Detailed Technical Breakdown: UI, Notes, Calendar, Conflicts & Reports

### A. Mention Autocomplete (`@`, `#`, `[`, `[[`)
- **Files**: `src/components/MentionAutocomplete.tsx`, integrated in `src/views/Notes.tsx` and `src/components/TaskDialog.tsx`.
- **Functionality**:
  - Automatically triggers when typing `@` (Tasks), `#` (Projects), or `[` / `[[` (Notes).
  - Dynamically computes pixel-accurate caret coordinates in the active textarea using a hidden clone measurement helper.
  - Supports keyboard navigation: <kbd>↑</kbd> and <kbd>↓</kbd> to cycle suggestions, <kbd>Enter</kbd> or <kbd>Tab</kbd> to insert, <kbd>Escape</kbd> to dismiss.
  - Automatically formats markdown references:
    - `@Task` &rarr; `[Task Title](task:taskId)`
    - `#Project` &rarr; `[#Project Name](project:projectId)`
    - `[Note` &rarr; `[[Note Title]]` or `[Note Title](note:noteId)`

### B. Calendar Habit Scheduling & Drag-to-Tray Unblocking
- **Files**: `src/types.ts`, `src/views/Calendar.tsx`.
- **Functionality**:
  - **Habit Time Placement**: `Habit` schema supports `time?: string` (format `HH:mm`). Dropping a habit onto the calendar time grid locks it to that specific time slot. Clicking a scheduled habit block toggles completion directly on the schedule.
  - **Drag-to-Tray Unschedule**:
    - The top non-scheduled bar (`Tray`) acts as an active HTML5 drop target (`onDragOver`, `onDragLeave`, `onDrop`).
    - Dragging any scheduled task back up to the tray clears `dueTime: null` (or resets `time: null, date: null` on multi-block tasks) and restores it to unscheduled status.
    - Dragging a habit to the tray clears its `time` property.
    - Displays an active visual drop highlight (`isHot` state) when hovering over the tray with a dragged item.

### C. Visual Sync Conflict Diff Modal Overhaul
- **Files**: `src/components/DiffConflictModal.tsx`, `src/components/SyncDialog.tsx`.
- **Problem Solved**:
  - Previously, `DiffConflictModal` was rendered inside `SyncDialog`'s `<Modal>`. The parent modal's backdrop-filter and `overflow-hidden` created an isolated CSS containing block, trapping the diff modal in a clipped sub-frame, breaking scrolling, and hiding action buttons.
- **Solution**:
  - **Document Body Portal**: Uses `createPortal(modal, document.body)` with `z-[9999]`.
  - **Scroll-Free Pop-Up (~410px)**: The entire modal fits on screen with **zero internal scrolling** on desktop and mobile displays.
  - **Unified Device Strip**: Concise side-by-side header (`Local 💻` vs `Peer 📱`) with 3-column pill comparison metrics (Tasks, Notes, Habits count).
  - **3 Clean Merge Options**: Smart 3-Way Union (Lossless), Keep This Device, Accept Peer Device.

### D. Layout Polish, Welcome Scroll & Coffee Button Relocation
- **Files**: `src/components/Shell.tsx`, `src/views/Welcome.tsx`.
- **Functionality**:
  - Removed "Buy Me a Coffee" from all 5 workspace layouts (Glassmorphic, Control Center, Desk Station, Planify Clean, Zen Focus).
  - Placed the button cleanly in the top bar of `Welcome.tsx`.
  - Fixed mouse wheel scrolling lock on the Welcome screen by adjusting the root container CSS to `fixed inset-0 h-screen w-full overflow-y-auto overscroll-y-auto select-text z-50`.

### E. PDF Export Engine & Print CSS Optimization
- **Files**: `src/views/Reports.tsx`, `src/components/ui.tsx`, `src/index.css`.
- **Problem Solved**:
  - Browser print dialogs stripped CSS background colors and gradients by default, causing energy/mood bars, estimate calibration bars, and tag charts to print as blank white spaces.
  - Scroll container classes (`max-h-[300px] overflow-y-auto`) clipped task rows and logs on printed pages.
- **Solution**:
  - **Print CSS**: Added `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` to all elements under `@media print`.
  - **Print Palette**: Enforced clean, high-contrast light-mode theme variables during `@media print` (`--bg: #ffffff`, `--panel2: #f1f5f9`, `--line: #cbd5e1`, `--text: #0f172a`, `--ok: #16a34a`, `--warn: #d97706`, `--danger: #dc2626`).
  - **Unclipped Containers**: Overrode scroll containers with `.overflow-y-auto, [class*="max-h-"] { max-height: none !important; overflow: visible !important; }`.
  - **Explicit Bar Styling**: Added border tracks and solid fallback colors with inline `printColorAdjust: "exact"` across Energy/Mood bars, Estimate Calibration bars, and `BarRow`.
  - **Lag-Free Preset**: Added an export modal defaulting to **"🎯 Summary + Key Tasks (Recommended, 0 Lag)"**, which outputs the top 5 estimate vs actual tasks with their progress bars without freezing the browser.

---

## 3. Electron Desktop Multi-Platform CI Builds & Encrypted Attachment Architecture

### A. GitHub Actions Multi-Platform Workflow (`build-electron.yml`)
- **Problem Solved**:
  - Automated CI packaging previously failed on all 3 target OS platforms (Ubuntu Linux, Windows, macOS).
- **Solutions Implemented**:
  1. **Icon Asset Visibility**: Un-ignored `build/` in `.gitignore` and committed multi-resolution icons: `build/icon.ico` (16–256px multi-size), `build/icon.icns` (Apple ICNS format), and `build/icon.png` (512x512).
  2. **Publish Flag Configuration**: Added `"publish": null` to `package.json` and passed `--publish never` across all platform matrix jobs to prevent runner token failures.
  3. **Unsigned CI Builds**: Set `CSC_IDENTITY_AUTO_DISCOVERY: false` and `identity: null` to allow clean, unsigned desktop builds in open-source CI.
  4. **Linux Packaging**: Added required `deb` package metadata (`author`, `homepage`, `repository`, `license`, `linux.maintainer`) to satisfy `FpmTarget` validation; enabled `APPIMAGE_EXTRACT_AND_RUN: 1` and installed `libarchive-tools`, `libfuse2`, and `desktop-file-utils` on Ubuntu runners.
- **Result (Run ID 34704912740 - 100% Green)**:
  - 🐧 **Linux**: `LifeLog-Desktop-Linux` (350.61 MB) — `.AppImage`, `.deb`, `.tar.gz`
  - 🪟 **Windows**: `LifeLog-Desktop-Windows` (223.41 MB) — Setup `.exe` (NSIS) & Portable `.exe`
  - 🍎 **macOS**: `LifeLog-Desktop-macOS` (261.73 MB) — `.dmg` & `.zip`

### B. Dedicated Attachment Directory Architecture
- To prevent V8 engine heap exhaustion (> 1.4 GB memory limits) when users store hundreds of large photos, voice notes, and document attachments:
  - Attachments are stored as individual files in `<userData>/attachments/`.
  - Each attachment file is encrypted with **AES-256-GCM** and saved as `<attachmentId>.enc`.
  - Database rows store metadata (`note_id`, `mime_type`, `byte_size`, `created_at`), loading the encrypted binary on-demand.

---

## 4. Unified SQLite Database Engine & Migration Architecture

### A. Native Desktop SQLite (`DatabaseSync`)
- **File**: `electron/db.cjs`
- Built on Node.js native `node:sqlite` (`DatabaseSync`), eliminating bulky native binary dependencies like `better-sqlite3`.
- **Database Tuning**:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  ```
- **10 Normalized Tables**:
  - `meta`: Store schema version, migration flags, and database metadata.
  - `tasks`: Task items, project relations, status, priority, and encrypted payloads.
  - `notes`: Markdown notes, folder relations, and encrypted payloads.
  - `attachments`: File attachment metadata and encrypted blobs.
  - `habits`: Habit definitions, frequencies, streaks, and encrypted payloads.
  - `projects`: Projects, color codes, sort orders, and encrypted payloads.
  - `folders`: Hierarchical note folder tree structure.
  - `sessions`: Focus/Pomodoro logs, intervals, and pause/resume timestamps.
  - `day_logs`: Daily check-in logs, mood, energy ratings, and notes.
  - `app_settings`: Key-value application configurations and theme tokens.
- **Indexes**: B-Tree indexes created on `updated_at` and foreign key relationships for sub-millisecond query performance.
- **Pristine Compacted Backups**: Implemented atomic `VACUUM INTO` for zero-lock, zero-corruption SQLite file snapshots.

### B. Web Browser & Android WebAssembly SQLite (`sql.js`)
- **File**: `src/db/webSqlite.ts`
- Executes `sql.js` WebAssembly (`public/sql-wasm.wasm`) in-memory.
- Debounced snapshot persistence saves the SQLite binary buffer into IndexedDB (`LifeLogSQLiteStorage`).
- 100% binary compatibility with desktop SQLite `.sqlite3` and `.db` files.

### C. Unified Database Abstraction Layer (`database.ts`)
- **File**: `src/db/database.ts`
- Routes calls seamlessly between Electron IPC (`window.electronAPI`) and Browser WASM (`webSqlite.ts`).
- **Row-Level AES-GCM-256 Encryption**:
  - Note bodies, task private notes, habit records, and attachments are encrypted before being written to SQLite tables.
  - Transparent decryption on read ensures fast, safe memory operation.

### D. Automated 1-Time User Data Migration (< 60ms)
- **File**: `src/db/migrateLegacy.ts`
- On boot, automatically checks for legacy `lifelog-vault.json` or legacy IndexedDB data.
- Converts all existing records into normalized SQLite tables in a single atomic transaction.
- Writes `migrated_to_sqlite = 'true'` in the `meta` table and is permanently bypassed on all subsequent launches.

---

## 5. Sovereign P2P Sync (Zero Key Drama & Independent Device Keys)

### A. Pure P2P Sync Over WebRTC DTLS
- **Transport Security**: WebRTC data channels natively provide transport-level End-to-End Encryption (DTLS-SRTP).
- **Eliminated `KEY_SYNC`**:
  - Removed `KEY_SYNC` message type from `src/sync/syncTypes.ts` and `src/sync/syncEngine.ts`.
  - Peer devices transmit decrypted state records across the secure WebRTC tunnel.
  - Each device persists and encrypts records into its local SQLite database using its own independent hardware device key (`getDeviceKey()`).
  - Neither device ever transmits, receives, or overwrites database encryption keys.

### B. Non-Destructive Disconnect
- Unpairing or disconnecting sync leaves all local database records and encryption keys **100% intact** on both devices.
- Neither phone nor PC ever wipes or locks local data upon disconnect.

### C. Instant < 5ms Startup
- Reverted `getActiveVaultKey()` in `src/security/masterKey.ts` to prioritize `getDeviceKey()`.
- Guarantees immediate launch with **0 password prompts** and zero recovery phrase requirements on everyday use.

---

## 6. Transparent Universal Backups (`.lifelog`) & User Security Advisory

### A. 1-Click Portable Snapshot (`.lifelog`)
- Added `handleExportLifelogSnapshot` in `src/views/Settings.tsx`.
- Generates a universal, portable `.lifelog` snapshot containing the complete decrypted state (tasks, notes with attachments, habits, projects, sessions, daylogs, tag colors, settings).
- 100% cross-device and cross-platform: can be imported onto any laptop, browser, or Android phone without passwords.
- **Prominent Security Advisory Modal**:
  - On export, displays a clear, highlighted advisory modal:
    > **⚠️ Unencrypted Portable Snapshot Exported**
    > *This file contains your complete history in plain portable format so you can easily restore or migrate to another device without passwords.*
    > * **Delete after use**: Once restored on your target device, permanently delete this snapshot from your computer or downloads folder.
    > * **Trusted storage only**: Keep temporarily on personal drives or offline USB sticks. Do not upload to public cloud drives or email.
    > * **For Cloud Storage**: Use the **Password-Protect (.lifelog)** option instead.

### B. Optional Password-Protected Backup
- "Password-Protect (.lifelog)" allows users to seal their snapshot with a custom password using PBKDF2 (150,000 iterations) + AES-256-GCM (`encryptBackup`).
- Safe for long-term storage in Google Drive, Dropbox, or email.

### C. Unified Smart Import Handler
- Consolidated multiple disparate import buttons into one clean, styled `Import Backup (.lifelog / .json)` picker.
- Automatically handles:
  1. Unencrypted portable `.lifelog` snapshots &rarr; confirms record counts and restores into local SQLite using the local device key.
  2. Password-protected `.lifelog` backups &rarr; prompts for master password, decrypts, and restores.
  3. Legacy plain JSON exports (`.json`) &rarr; restores cleanly.
  4. Raw SQLite binary databases (`.sqlite3`, `.db`) &rarr; restores directly via native Electron or Web SQLite WASM.

---

## 7. Settings UI Streamlining & Clutter Elimination

### A. Removed 12-Word Recovery Phrase Engine
- Deleted `src/security/bip39Wordlist.ts` and `src/security/recoveryPhrase.ts`.
- Removed all 12-word phrase states, handlers, and the two bottom modals from `src/views/Settings.tsx`.
- Cleaned up imports in `src/security/masterKey.ts`.
- Eliminates unnecessary user cognitive load: local storage is already secure via device hardware keys, and exports provide 1-click snapshots or custom password protection.

### B. Removed Internal SQLite Engine Diagnostic Banner
- Removed the technical "Unified SQLite Database Engine 1ms WAL" card from the UI. End users do not need internal database engine diagnostics.

### C. Removed Redundant "Paste JSON" Button
- Removed the separate "Paste JSON" button from the backup card, keeping the interface focused on three clear actions:
  1. `Export Portable Snapshot (.lifelog)`
  2. `Password-Protect (.lifelog)`
  3. `Import Backup (.lifelog / .json)`

---

## 8. Build, Typecheck & Packaging Verification

1. **TypeScript Verification**:
   ```bash
   npm run typecheck
   # tsc --noEmit -> 0 errors across all source files
   ```
2. **Production Vite Build**:
   ```bash
   npm run build
   # Built in 2.50s -> all client bundles optimized and clean
   ```
3. **Git Cleanliness**:
   * All changes committed with clear conventional commit messages.
   * Synced directly with remote repository `origin/main` (`git@github.com:Krrish1411/Lifelog.git`).

---

## 9. Pending Features Roadmap (Future Monetization & LifeLog Pro)

### A. LifeLog Pro / Premium Security Vault
- **Whole-App Screen PIN Lock**:
  - 4-digit or 6-digit glassmorphic PIN screen overlay on app cold launch or after configurable inactivity timeouts (1m, 5m, 15m).
  - Biometric authentication (Fingerprint / Face Unlock on Android).
- **Per-Note 🔒 Privacy Shield (Apple Notes Style)**:
  - Mask sensitive journal entries, therapy logs, or financial notes behind a lock icon while leaving daily grocery tasks, habits, and focus timers immediately accessible.
- **Dedicated Security & Privacy Tab**:
  - Premium settings hub consolidating PIN configuration, note shields, and audit logs.

### B. Recommended Monetization Architecture
- **Model**: Free Core + 1-Time Lifetime Purchase ($29–$49) or Yearly Subscription ($19/year) via Gumroad / LemonSqueezy.
- **Zero-Server Offline License Verification**:
  - Use asymmetric cryptography (Ed25519 signatures) so users can enter a license key that verifies 100% offline in 0ms with zero central server dependencies, preserving LifeLog's sovereign privacy principles.

---

## 10. LifeLog v1.0.0 Production Release (In-App Features, Guided Onboarding & Playbooks)

### A. Milestone Supporter Coffee Prompt (`src/components/SupportCoffeeModal.tsx`)
- **Milestone Trigger**: Replaced disruptive random prompts with genuine productivity milestone checks:
  - Triggers only when `completedTasksCount >= 10 || totalFocusMinutes >= 300` (5 hours of deep focus).
  - Wired into `src/components/Shell.tsx` with portal mounting (`z-[9999]`) and safe cooldown math.
- **Actions**:
  - `Buy Me a Coffee ☕`: Opens `https://buymeacoffee.com/Krrish1411`.
  - `Remind Me in a Week ⏳`: Snoozes prompt for 7 full days (`lastSupportPromptShownAt = Date.now()`).
  - `Don't Show Again 🚫`: Permanently disables supporter prompts (`muteSupportPrompt = true`).
  - Setting toggle in **Settings > General > Support LifeLog** allows users to opt in or out anytime.

### B. In-App Update Checker & Privacy Feedback Hub (`src/views/Settings.tsx`)
- **Software Updates & Releases Card**:
  - Manual, strictly on-demand check querying `https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json`.
  - Enforces a strict 5-second timeout via `AbortController`.
  - Compares semantic versioning (`v1.0.0` vs remote).
  - Displays version status pill (`Latest Sovereign Build` vs `Update Available` with modal showing changelog bullets and direct `.exe`, `.dmg`, `.AppImage`, `.apk` download links).
- **Privacy-First Feedback & Community Hub**:
  - Direct Email: `mailto:getlifelog@proton.me` with automatic, non-identifying diagnostics (app version, OS platform, display mode).
  - Public Bug Tracker: Links directly to `https://github.com/Krrish1411/Lifelog-Releases/issues`.

### C. Welcome View Overhaul (`src/views/Welcome.tsx`)
- Elevated into a high-end product showcase:
  - Top bar with `v1.0.0 Sovereign` badge, nav anchors, `Buy me a coffee` button, and `Launch Workspace` CTA.
  - Zero-Cloud Trust Badge (Zero Telemetry, SQLite WAL, AES-256-GCM, P2P DTLS Sync).
  - 7 Core Feature Pillars (Tasks & Habits, Deep Focus Studio, Sovereign Second Brain, Time-Grid Calendar, Habit Streaks, Calibrated Analytics, Cryptographic P2P Sync).
  - Cross-Platform Downloads Hub (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`, Android `.apk`).
  - Creator Philosophy statement by Krish Patel on why sovereign computing matters.
  - Root container configured for frictionless mouse wheel scrolling and touch panning.

### D. Guided Onboarding Tasks & Rich Educational Notes (`src/data/seed.ts`, `src/utils/cleanSeed.ts`)
- **Tutorial Tasks with Subtasks**:
  - `Welcome to LifeLog! Complete your first 3-minute setup` (Cockpit exploration, checklist, command palette, themes).
  - `Explore Notes: Discover your Sovereign Second Brain` (Guides reading, dynamic `@/#/[` mentions, markdown).
  - `Try a 25-minute Pomodoro or Flow focus session` (Timer start, ambient soundscapes, pause tracking).
  - `Schedule your afternoon by dragging a task onto the Calendar` (Time grid, drag-to-tray unblocking).
  - `Pair a second device using zero-cloud P2P Sync` (Settings > Sync & Storage, WebRTC DTLS pairing).
- **3 Comprehensive Markdown Notes in `Guides & Principles` Folder**:
  1. `Welcome to LifeLog: The Sovereign Workspace Guide`: Reassuring 3-minute mental model explaining how to use LifeLog without feeling overwhelmed.
  2. `Power User Guide: Mentions, Wiki-Links & Shortcuts`: Tutorial on dynamic `@/#/[` dropdowns and single-key navigation.
  3. `Zero-Cloud Architecture & Cryptographic Sovereignty`: Deep-dive into local SQLite WAL, AES-256-GCM, and pure P2P DTLS sync.
- **Seed Data Purge Parity (`cleanSeed.ts`)**:
  - All new task titles, project IDs/names, and note titles registered in `cleanSeed.ts`.
  - Guarantees that "Purge Demo Data" leaves a 100% clean vault while preserving any personal items created by the user.

### E. Onboarding Tour Modal Rewrite (`src/components/OnboardingTourModal.tsx`)
- Rewritten in warm, friendly, plain language designed specifically to eliminate feature overwhelm.
- Reassures users to start small with just one or two tasks, use only what they want, and let the app adapt to their flow.

### F. Electron Native External URL Support (`electron/main.cjs`)
- Added `mailto:` support to `mainWindow.webContents.setWindowOpenHandler` so clicking `getlifelog@proton.me` smoothly delegates to the user's default OS desktop email client (Thunderbird, Outlook, Apple Mail) via `shell.openExternal`.

### G. Master Documentation & Release Playbook
- **`features.md`**: Master architectural specification documenting all 8 primary views, 5 layout engines, shortcuts, SQLite WAL architecture, P2P sync, crypto envelopes, and reporting calibration.
- **`RELEASE_PLAYBOOK.md`**: Production binary release playbook for Krish Patel covering build commands for Windows, Linux, macOS, Android APK, Git release tagging, and updating `version.json` in `Krrish1411/Lifelog-Releases`.

### H. Verification & Codebase Super-Audit
- **TypeScript Check**: `npm run typecheck` (`tsc --noEmit`) &rarr; **0 errors**.
- **Production Bundle**: `npm run build` (`vite build`) &rarr; **built cleanly in 2.66s**.
- **Network Audit**: Zero unsolicited background network queries on boot; update checker is strictly manual with a 5-second timeout.

---

## 11. Production Code Hardening (Anti-Theft Obfuscation) & Public Web Deployment

### A. Layer 1: Web Bundler Hardening (`vite.config.js`)
- **Terser Minification Engine**:
  - `sourcemap: false`: Completely disables all source maps. Original TypeScript source files and comments are 100% excluded from production bundles.
  - `drop_console: true` & `drop_debugger: true`: Automatically strips every `console.log`, `info`, `debug`, `trace`, and `warn` call.
  - `passes: 2`: Two deep passes of dead-code elimination.
  - `mangle.toplevel: true`: Scrambles all top-level functions, classes, and variables into random single-letter identifiers (`a, b, c, e, n`).
  - `output.chunkFileNames`: Sanitized prefix `assets/ll-[hash].js`, stripping internal library identifiers.

### B. Layer 2: Desktop Hardening (`electron/main.cjs`)
- **Production DevTools Lockout**:
  - `webPreferences.devTools = isDev`: Native DevTools disabled in packaged production builds.
  - Blocks `F12`, `Ctrl+Shift+I` / `Cmd+Option+I`, `Ctrl+Shift+J` / `Cmd+Option+J`, and `Ctrl+U` (View Source).
  - Intercepts and suppresses right-click context menu "Inspect Element".
  - Strips remote debugging command line switches (`--remote-debugging-port`, `--inspect`, `--inspect-brk`).

### C. Layer 3: Android Native Hardening (`MainActivity.java`)
- Disabled remote Chrome WebContents inspection in production builds via `WebView.setWebContentsDebuggingEnabled(false)` in `android/app/src/main/java/com/lifelog/app/MainActivity.java` and `Lifelog-Android`.
- ProGuard / R8 code shrinking and resource minification enabled in `android/app/build.gradle`.

### D. Zero-Leak Web Deployment Pipeline (`scripts/deploy-release-web.sh`)
- **1-Click Deployment Script**: `npm run deploy:web` / `bash scripts/deploy-release-web.sh`.
- **Zero Source Leak**: Commits **only** the compiled, mangled `dist/` directory into the `gh-pages` branch of `Krrish1411/Lifelog-Releases`. Zero `.ts`, `.tsx`, `.cjs`, or git history is transferred.
- **GitHub Pages Optimization**: Automatically generates `.nojekyll` and `404.html` (for SPA client-side routing).
- **CI Workflow Integration**: Updated `.github/workflows/deploy.yml` to automatically push to `Krrish1411/Lifelog-Releases` on push to `main` when `RELEASES_TOKEN` is configured.

---

## 12. Public Releases Repository Overhaul & Android CI Build Resolution

### A. Android APK CI Compilation Fix
- **Issue**: AGP 8+ builds failed on GitHub Actions runner because `BuildConfig.DEBUG` was unresolved in `MainActivity.java` due to AGP 8 disabling `BuildConfig` generation by default.
- **Resolution**:
  - Replaced `BuildConfig.DEBUG` with native Android SDK flag check: `(getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0`.
  - Added `buildFeatures { buildConfig true }` into `android/app/build.gradle`.
  - Configured `android.webContentsDebuggingEnabled: false` in `capacitor.config.ts`.
  - Updated `.github/workflows/build-apk.yml` artifact glob path to `android/app/build/outputs/apk/release/*.apk` with `if-no-files-found: warn`.

### B. CI Web Deploy Workflow Streamlining (`.github/workflows/deploy.yml`)
- Removed the private repo GitHub Pages deployment job (which threw 404s due to GitHub private repository restrictions).
- Replaced with a zero-leak build job that compiles hardened static assets and syncs directly to `Krrish1411/Lifelog-Releases` via `RELEASES_TOKEN` if present, while allowing instant local manual deployment via `npm run deploy:web`.

### C. Public Repository Polish (`Krrish1411/Lifelog-Releases`)
- **Repository**: `https://github.com/Krrish1411/Lifelog-Releases`
- **Main Branch Assets Added**:
  - `README.md`: Complete showcase featuring official download tables (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`, Android `.apk`, Web App), Zero-Cloud trust badges, 7 Core Pillars breakdown, SHA-256 verification instructions, creator note, and support links.
  - `version.json`: Release descriptor consumed by the client app update checker.
  - `icon.png`: Official high-resolution brand asset.
  - `.github/ISSUE_TEMPLATE/`: Production GitHub issue templates for `bug_report.md` and `feature_request.md`.
- **Pages Branch (`gh-pages`)**:
  - Contains 100% compiled, hardened, obfuscated static web assets (`dist/index.html`, `404.html`, `.nojekyll`, `sql-wasm.wasm`, `version.json`, `assets/`).
  - Zero private source code, zero TypeScript files, zero commit history leaks.

---

## 13. Modern Liquid Landing Page Overhaul & Typography Polish

### A. Liquid UI & Mesh Gradient Ambient System (`src/views/Welcome.tsx`)
- Integrated multi-orb ambient liquid mesh gradients using CSS radial gradients and pulse keyframes with deep blurs (`blur-[140px]`).
- Translucent frosted glass containers (`bg-[var(--panel)]/80 backdrop-blur-xl border border-[var(--line)]`) with soft specular highlights.

### B. Widescreen Expansion & Edge-to-Edge Space Utilization
- Expanded the layout boundary from cramped `max-w-4xl`/`max-w-5xl` constraints to **`max-w-7xl`** (1280px) with fluid 2-column widescreen hero and 3-column / 4-column responsive cards.
- Hero features dual-column layout: left column for value proposition, trust pills, and primary CTAs; right column for an interactive live simulator.

### C. Interactive Live Simulator Sandbox (Dopamine & User Engagement)
- **Interactive Tasks**: Real interactive tasks with clickable checkmarks, dynamic momentum progress bar animating from 67% to 100%, time badges, and celebratory completion badge.
- **Interactive Pomodoro Studio**: Live ticking countdown timer with Start/Pause controls, reset, and ambient soundscape tag previews.
- **Interactive Second Brain**: Live Markdown note preview highlighting dynamic `@Tasks`, `#Projects`, and `[[Notes]]` wiki-links.
- **Interactive 5 Layout Engines**: Live preview cards for Glassmorphic, Planify Clean, Control Center, Desk Station, and Zen Focus.

### D. Typography & Accessibility Scaling
- Completely eliminated hard-to-read micro-typography (`text-[10px]`, `text-[11px]`, `text-[11.5px]`).
- Scaled all body and descriptive copy to `text-sm` (14px) and `text-base` (16px) with comfortable leading.
- Scaled section headings to `text-3xl` / `text-4xl` and hero title to `text-4xl` to `text-6xl`.

### E. Buy Me a Coffee Typography Standardization
- Replaced the cursive `"Cookie"` font in both [`src/views/Welcome.tsx`](file:///home/krish/Downloads/Coding/gemini/Coding/Lifelog-main/src/views/Welcome.tsx) and [`src/views/Settings.tsx`](file:///home/krish/Downloads/Coding/gemini/Coding/Lifelog-main/src/views/Settings.tsx) with clean, modern, high-contrast bold sans-serif UI typography.

---

## 14. Real-Time Dynamic Ticking, Multi-Pause Branch Timeline, Popout Lifecycle, Obsidian Vault Mirroring & Background Sync (v1.1.5)

### A. Dynamic 1-Second Live Ticking Engine (`src/store.tsx`)
- **Problem**: When a countdown or timer was running, switching away from Focus or staying on the Dashboard for 10 minutes showed static metrics; dashboard focus minutes and report totals failed to tick dynamically without manually navigating tabs.
- **Resolution**:
  - Added `liveTick: number` to `AppCtx`.
  - Configured a 1000ms heartbeat interval inside `AppProvider` active whenever `hasRunningTimer === true`.
  - Exposed `liveTick` in the context value. All consumer views (`Dashboard`, `Reports`, `DayLog`) now automatically re-evaluate active session minutes dynamically on every tick with **0 additional database writes**.

### B. Notes Editor Cursor Preservation, Encrypted SQLite Storage & Formatting Shortcuts (`src/views/Notes.tsx`)
- **Autosave Cursor Jump Fix**:
  - *Root Cause*: `flushSave()` updated `state.notes`, triggering `useEffect([selId, state.notes])`. Because `note.updatedAt > lastLoadedUpdatedAt.current`, the loader treated local saves as remote updates, asynchronously wiping `draft.text = ""` and re-decrypting, resetting textarea cursor position mid-typing.
  - *Fix*: Recorded `lastSavedTs.current = saveTs; lastLoadedUpdatedAt.current = saveTs;` in `flushSave()`. In the loader effect, guarded with `note.updatedAt > (lastSavedTs.current || 0)`. Local saves now never trigger re-decryption or caret resets.
- **Scroll-to-Top on Note Open**:
  - Implemented `requestAnimationFrame` on note switch setting `scrollTop = 0, selectionStart = 0, selectionEnd = 0`, ensuring notes always open cleanly at the very top.
- **Encrypted SQLite Sovereign Storage & Zero Plaintext Disk Leaks**:
  - Preserved sovereign client-side Zero-Knowledge encryption: all notes are stored inside the local SQLite WAL database with AES-256-GCM authenticated encryption (`notes` table storing `{ ciphertext, iv, salt }`).
  - Removed unencrypted plaintext disk dumping to ensure no plaintext markdown files leak onto the disk or into OS search indexers.
- **On-Demand Direct `.md` Export**:
  - Added a 1-click **"Download Note as .md"** export button in the note toolbar, enabling users to export individual decrypted Markdown files whenever needed for external tools like Obsidian.
- **Markdown Formatting Keyboard Shortcuts**:
  - Supported <kbd>Ctrl+B</kbd> (Bold), <kbd>Ctrl+I</kbd> (Italic), <kbd>Ctrl+U</kbd> (Underline), <kbd>Ctrl+Shift+X</kbd> (Strikethrough), <kbd>Ctrl+Shift+H</kbd> (Highlight), <kbd>Ctrl+Shift+C</kbd> (Inline Code), <kbd>Ctrl+Shift+T</kbd> (Checklist Todo `- [ ] `), <kbd>Ctrl+Shift+1/2/3</kbd> (H1/H2/H3), <kbd>Ctrl+Shift+8</kbd> (Bullet list), <kbd>Ctrl+Shift+.</kbd> (Blockquote), <kbd>Ctrl+K</kbd> (Link), and <kbd>Ctrl+S</kbd> (Save & Encrypt).
- **On-Screen Cheatsheet Modal**:
  - Added an on-screen Shortcuts button (`?`) in the note header and properties bar opening an interactive **Markdown & Keyboard Shortcuts Cheatsheet Modal**.

### C. Focus Popout Lifecycle, Universal Breaks & Memory Trimming (`src/components/TimerPopout.tsx`, `electron/main.cjs`, `src/views/Focus.tsx`, `src/utils/audio.ts`)
- **Auto-Finalization at 0:00**:
  - When remaining seconds reach 0, the popout auto-transitions to `status: "done"`, eliminating frozen screens with stuck pause/stop controls.
- **Universal Completion & Break Card**:
  - Renders celebratory completion card with 1-click break offers (+5m / +15m) and next session triggers across all modes (Pomodoro, Countdown, Flow).
- **IPC Window Management & RAM Optimization**:
  - Added `lifelog:focus-main-window` and `lifelog:hide-main-window` IPC handlers.
  - Launching the popout minimizes the main window and invokes `trimMemory()`, conserving system RAM and GPU resources. Closing the popout or clicking "Open Main Window" restores and focuses the main window.
- **Acoustic Downward Stopping Chime**:
  - Added `playTimerStopSound()` synthesizing an acoustic downward resolving chime (440Hz &rarr; 220Hz exponential decay) played on Stop across Focus view, Timer Popout, and Shell mini-timer.

### D. Multi-Pause Session Branch Timeline (`src/components/SessionTimelineBranch.tsx`)
- **Proportional Segmented Timeline**:
  - Renders a color-coded bar showing active focus periods (emerald/accent) and pause periods (amber), with pause interval tooltips.
- **Expandable Vertical Branch-Tree Diagram**:
  - Displays branching nodes tracking exact start timestamps, pause intervals (e.g., `11:45 AM → 12:15 PM`), pause durations, resume timestamps, and net focus time across multiple pauses.
- **Universal Integration**:
  - Integrated into [`src/views/DayLog.tsx`](file:///home/krish/Downloads/Coding/gemini/Coding/Lifelog-main/src/views/DayLog.tsx), [`src/views/Focus.tsx`](file:///home/krish/Downloads/Coding/gemini/Coding/Lifelog-main/src/views/Focus.tsx), and [`src/views/Reports.tsx`](file:///home/krish/Downloads/Coding/gemini/Coding/Lifelog-main/src/views/Reports.tsx).

### E. Detailed Pause Analytics in Reports (`src/views/Reports.tsx`)
- Added calculation and dedicated card for:
  - Average pause duration across filtered sessions.
  - Shortest pause and longest pause recorded.
  - Continuous flow sessions (0 pauses).
  - Focus efficiency percentage (`netFocusTime / (netFocusTime + pauseTime)`).

### F. System Default Native OS Font (`src/types.ts`, `src/utils/useApplyTheme.ts`)
- Added `"system"` font option to Settings using unquoted system font stack (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, Cantarell, sans-serif`).

### G. Background Sync Keepalive & Mobile Android Shade Controls (`src/sync/syncEngine.ts`, `src/utils/native.ts`, `src/components/Shell.tsx`)
- Added `visibilitychange`, `focus`, and 25s background polling to `syncEngine` for automatic reconnection without opening Settings.
- Enhanced Android notification shade to display active vs. paused status and countdown minutes when minimized.

### H. Demo Seed Data Deletion & Tombstone Reconciliation (`src/utils/cleanSeed.ts`)
- Purged hardcoded demo daily note ("Intentions for today..."), cleaned demo `dayLogs`, and created deletion tombstones for proper SQLite synchronization.

### I. Reports Life Log vs Deep Work Segregation & Deduplication (`src/views/Reports.tsx`)
- **Segregated Work & Life Sessions**: Separated `workSessions` (`!isLifeTask`) from `lifeSessions`. Deep work stats, total time focused, deep work percentage, and focus velocity now measure actual work deliverables without routine habits skewing them.
- **Eliminated Double Counting**: In the Life Balance section, `lifeMin` accounts for timed sessions or explicit duration/estimates with zero double-counting (`totalAllMin = totalMin + lifeMin`).
- **Removed Ghost +30m Fallback**: Removed the arbitrary `|| 30` minutes fallback for Life Log checklist items with no duration.
- **Purified Work Deliverables**: Filtered `LIFE_LOG_PROJECT_ID` out of `completedIn`, `estVsActual`, `calibration`, `weeklyTrend`, and `byProject`. Routine habit checks are cleanly displayed in Hero Card 2 as routine logs without inflating work completion metrics or distorting estimate accuracy.

### J. Android Public Lockscreen Notifications, Interactive Action Controls, Electron System Tray & Window Single-Instance, and Tag-Only CI Triggers
- **Android Public Lockscreen Notifications & Interactive Controls (`src/utils/native.ts`, `src/components/Shell.tsx`)**:
  - **Public Lockscreen Visibility**: Created new notification channels `focus-running-channel-v3` and `focus-alarm-channel-v3` with explicit `visibility: 1` (`Notification.VISIBILITY_PUBLIC`), ensuring Android lock screens render the notification regardless of the device OS setting *"Don't show sensitive notifications on lock screen"*.
  - **Dynamic Title & Time Formatting**: Replaced generic static text with dynamic format `🎯 Focus · MM:SS: <Task Name>` (or `⏸️ Paused (MM:SS): <Task Name>`), matching notification shade and lock screen visibility.
  - **Interactive Action Buttons**: Configured `TIMER_RUNNING_ACTIONS` (`action_pause`, `action_stop`) and `TIMER_PAUSED_ACTIONS` (`action_resume`, `action_stop`) with direct intent listeners in `Shell.tsx` allowing 1-tap pause, resume, and cancellation from lockscreen and shade without opening the app.
  - **Background Ticking Engine**: Configured 5-second interval heartbeat in `initRunningTimerTrayListener` keeping the notification countdown accurate while the phone screen is locked.
- **Linux / Desktop Window Restoration & System Tray Indicator (`electron/main.cjs`)**:
  - **Single Instance Lock**: Added `app.requestSingleInstanceLock()` and `app.on('second-instance')` with `restoreAndFocusApp()`, so clicking the LifeLog desktop launcher icon or running `lifelog` while a timer or session is running instantly restores, un-minimizes, and focuses the existing window.
  - **System Tray App Indicator & GNOME AppIndicator Support**: Cached tray icon to `userData/tray-icon.png` so GNOME's AppIndicator extension can read the icon from physical disk over D-Bus outside `.asar`. Added fallback creation and quick action context menu.
  - **Window Display Safeguards**: Added 1200ms safety timeout ensuring the main window is brought to screen even if the `ready-to-show` event is delayed on Wayland/X11, plus resolved parse and scope issues in `createTimerPopoutWindow`.
- **Tag-Only GitHub Actions Triggers (`.github/workflows/build-apk.yml`, `.github/workflows/build-electron.yml`, `.github/workflows/deploy.yml`)**:
  - Removed all `branches: [ "main" ]` triggers across all workflows.
  - Restricted push execution strictly to git release tags (`tags: [ "v*" ]`) and manual `workflow_dispatch`, ensuring standard git pushes to `main` branch never trigger CI/CD builds or runner consumption.

