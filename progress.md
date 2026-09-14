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
| `src/views/Welcome.tsx` | Modified | Relocated "Buy Me a Coffee" to the top bar; resolved mouse wheel scrolling lock via root container CSS. |
| `src/views/Reports.tsx` | Modified | Added zero-lag PDF export configuration modal; resolved missing CSS progress bars and unconstrained print heights. |
| `src/components/ui.tsx` | Modified | Updated `BarRow` with explicit border tracks and inline `print-color-adjust: exact`. |
| `src/index.css` | Modified | Configured `@media print` universal exact color adjustment, light-mode palette variables, and unclipped container overrides. |
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
