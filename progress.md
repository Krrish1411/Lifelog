# LifeLog — Engineering Progress & Changelog

This document provides a concise yet comprehensive summary of the recent enhancements, bug fixes, and architectural refinements implemented in LifeLog. Any developer or AI working on this codebase can reference this file to understand what changes are intact, where they reside, and why they were built.

---

## 1. Summary of Changed & New Files

| File | Status | Purpose / What Changed |
|---|---|---|
| `src/components/MentionAutocomplete.tsx` | **NEW** | Floating mention dropdown with dynamic caret positioning for `@` (Tasks), `#` (Projects), and `[` / `[[` (Notes). |
| `src/views/Notes.tsx` | Modified | Integrated `MentionAutocomplete` into the note editor body textarea. |
| `src/components/TaskDialog.tsx` | Modified | Integrated `MentionAutocomplete` into the task notes textarea. |
| `src/types.ts` | Modified | Extended `Habit` with optional `time?: string` and `order?: number` for calendar scheduling. |
| `src/views/Calendar.tsx` | Modified | Enabled habit drag-and-drop time placement; implemented drag-to-tray unscheduling/unblocking; removed Pro ICS teaser. |
| `src/components/DiffConflictModal.tsx` | Overhauled | Rebuilt as a portal-mounted, scroll-free (~410px) pop-up with a unified device comparison strip and compact merge options. |
| `src/components/SyncDialog.tsx` | Modified | Moved `DiffConflictModal` outside the inner `<Modal>` to prevent CSS filter/transform clipping; removed commercial Pro cloud banners. |
| `src/views/Settings.tsx` | Modified | Removed the "Upcoming Pro Cloud Infrastructure" commercial roadmap block. |
| `src/components/Shell.tsx` | Modified | Removed the "Buy Me a Coffee" button across all 5 engine layouts to keep core navigation clean. |
| `src/views/Welcome.tsx` | Modified | Placed "Buy Me a Coffee" in the top bar; resolved mouse wheel scrolling lock via root container CSS. |
| `src/views/Reports.tsx` | Modified | Added lag-free PDF export configuration modal; fixed missing progress bars and unconstrained print heights for energy/mood and estimate calibration. |
| `src/components/ui.tsx` | Modified | Updated `BarRow` with explicit border tracks and `print-color-adjust: exact`. |
| `src/index.css` | Modified | Enhanced `@media print` with universal exact color adjustment, light-mode palette variables, and unclipped container overrides. |

---

## 2. Detailed Technical Breakdown

### A. Mention Autocomplete (`@`, `#`, `[`, `[[`)
- **File**: `src/components/MentionAutocomplete.tsx`
- **Integrations**: `src/views/Notes.tsx`, `src/components/TaskDialog.tsx`
- **Behavior**:
  - Automatically activates when typing `@` (Tasks), `#` (Projects), or `[` / `[[` (Notes).
  - Continuously updates suggestions in real-time as the user types queries after the trigger.
  - Dynamically calculates caret coordinates in the textarea using a hidden clone measurement helper.
  - Supports keyboard navigation: <kbd>↑</kbd> and <kbd>↓</kbd> to cycle items, <kbd>Enter</kbd> or <kbd>Tab</kbd> to insert, <kbd>Escape</kbd> to dismiss.
  - Inserts standard LifeLog markdown references:
    - `@Task` &rarr; `[Task Title](task:taskId)`
    - `#Project` &rarr; `[#Project Name](project:projectId)`
    - `[Note` &rarr; `[[Note Title]]` or `[Note Title](note:noteId)`

### B. Calendar Habit Scheduling & Drag-to-Tray Unblocking
- **Files**: `src/types.ts`, `src/views/Calendar.tsx`
- **Behavior**:
  - **Habit Placement**: `Habit` now supports `time?: string` (format `HH:mm`). Dropping a habit onto the calendar time grid locks it to that specific time slot. Clicking a scheduled habit block toggles completion directly on the schedule.
  - **Drag-to-Tray Unschedule**:
    - The top non-scheduled bar (`Tray`) acts as an active drop target (`onDragOver`, `onDragLeave`, `onDrop`).
    - Dragging any scheduled task back up to the tray clears `dueTime: null` (or resets `time: null, date: null` on multi-block tasks) and restores it to unscheduled status.
    - Dragging a habit to the tray clears its `time` property.
    - Added an active visual highlight (`isHot` state) when hovering over the tray with a dragged item.

### C. Visual Sync Conflict Diff Modal Overhaul
- **Files**: `src/components/DiffConflictModal.tsx`, `src/components/SyncDialog.tsx`
- **Problem Fixed**:
  - Previously, `DiffConflictModal` was rendered inside `SyncDialog`'s `<Modal>`. Because the parent modal used backdrop-filter and `overflow-hidden`, standard CSS made it the containing block for fixed positioning. This trapped the diff modal in a double-frame box, clipped the bottom buttons, and broke scrolling.
- **Solution**:
  - **Root Portal**: Uses `createPortal(modal, document.body)` with `z-[9999]`, rendering directly at the document body.
  - **Single Compact Pop-Up (~410px)**: The entire modal fits on screen with **zero internal scrolling** needed on desktops, laptops, and mobile screens.
  - **Unified Device Strip**: Replaced two bulky multi-row boxes with a concise side-by-side header (`Local 💻` vs `Peer 📱`) and 3-column pill comparison metrics (Tasks, Notes, Habits count).
  - **3 Clean Merge Options**: Smart 3-Way Union (Lossless), Keep This Device, Accept Peer Device.
  - **Always-Visible Footer**: E2EE AES-256 badge, Cancel, and Apply Resolution buttons are permanently accessible.

### D. Buy Me a Coffee Relocation & Welcome Screen Scroll
- **Files**: `src/components/Shell.tsx`, `src/views/Welcome.tsx`
- **Behavior**:
  - Removed coffee support button from all 5 engine layouts (Glassmorphic, Control Center, Desk Station, Planify Clean, Zen Focus).
  - Placed the button in the top bar of `Welcome.tsx`.
  - Fixed mouse wheel scrolling lock on the Welcome screen by configuring the root container to `fixed inset-0 h-screen w-full overflow-y-auto overscroll-y-auto select-text z-50`.

### E. Commercial Pro Feature Cleanup
- **Files**: `src/views/Settings.tsx`, `src/components/SyncDialog.tsx`, `src/views/Calendar.tsx`
- **Behavior**:
  - Removed "Upcoming Pro Cloud Infrastructure" upgrade sections and teaser banners.
  - Preserved full architectural roadmap and backend specifications in `PENDING-FEATURES.md` for future monetization / feature tier discussions.

### F. PDF Export Optimization & Progress Bar Rendering
- **Files**: `src/views/Reports.tsx`, `src/components/ui.tsx`, `src/index.css`
- **Problem Fixed**:
  - When exporting to PDF or printing, browser print engines strip CSS background colors and gradients by default, causing energy/mood bars, estimate vs actual bars, and tag charts to render as blank white space.
  - Container classes with `max-h-[300px] overflow-y-auto` clipped check-in logs and task lists on printed pages.
  - The previous default "Executive Summary" mode omitted task rows entirely.
- **Solution**:
  - **Print CSS**: Added `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` to `*, *::before, *::after` in `src/index.css`.
  - **Print Palette**: Enforced clean, high-contrast light-mode theme variables during `@media print` (`--bg: #ffffff`, `--panel2: #f1f5f9`, `--line: #cbd5e1`, `--text: #0f172a`, `--ok: #16a34a`, `--warn: #d97706`, `--danger: #dc2626`).
  - **Unclipped Containers**: Overrode scroll containers with `.overflow-y-auto, [class*="max-h-"] { max-height: none !important; overflow: visible !important; }`.
  - **Explicit Bar Styling**: Added border tracks and solid fallback hex colors (`#16a34a`, `#d97706`, `#dc2626`, `#94a3b8`) with inline `printColorAdjust: "exact"` across Energy/Mood bars, Estimate Calibration bars, and `BarRow`.
  - **Export Modal**: Added an export modal defaulting to **"🎯 Summary + Key Tasks (Recommended, 0 Lag)"**, which includes the top 5 estimate vs actual tasks with their progress bars without lagging the browser on large datasets.

---

## 4. Electron Desktop Multi-Platform CI Builds & Encrypted Attachment Architecture

### A. GitHub Actions Multi-Platform Workflow (`build-electron.yml`)
- **Problem**:
  - Desktop builds failed across all 3 platforms (Ubuntu Linux, Windows, macOS).
  - **Root Cause 1**: `.gitignore` ignored `build/`, preventing application icons (`.png`, `.ico`, `.icns`) from being pushed to the repository. Runners failed during packaging due to missing icon files.
  - **Root Cause 2**: In CI (`CI=true`), `electron-builder` defaulted to publishing releases, failing immediately due to a missing GitHub Personal Access Token.
  - **Root Cause 3**: macOS runner attempted to invoke `codesign` with an Apple Developer identity that did not exist on the runner.
  - **Root Cause 4**: Ubuntu runner lacked FUSE and archive utilities required for AppImage creation.
- **Solution**:
  - Un-ignored `build/` in `.gitignore` and committed explicit multi-size icons: `build/icon.ico` (multi-size 16-256px), `build/icon.icns` (Apple ICNS), and `build/icon.png` (512x512) alongside `electron/icons/`.
  - Added `"publish": null` to `package.json` and passed `--publish never` across all platform jobs.
  - Configured `CSC_IDENTITY_AUTO_DISCOVERY: false` and `identity: null` to permit clean, unsigned CI builds.
  - Added `sudo apt-get install -y libarchive-tools libfuse2` on the Linux runner.

### B. Database Architecture: Web Browser vs. Desktop vs. Android
- **Web Browser (IndexedDB + Web Crypto AES-256-GCM)**:
  - Stays on **IndexedDB**. Web browsers cannot execute native SQLite without heavy WASM layers that consume excessive RAM and are subject to browser storage quotas. IndexedDB is zero-dependency, ultra-fast, and supported in 100% of modern browsers.
- **Desktop Electron (Encrypted Attachments Folder + Local Vault)**:
  - When users have 1,000+ tasks, long notes, and 1–2 GB of attachments, packing attachments into a single database or JSON crashes V8 engine heap memory (>1.4 GB limit).
  - Implemented a dedicated native encrypted directory: `<userData>/attachments/`.
  - Every attachment is encrypted with **AES-256-GCM** and saved as an isolated `<attachmentId>.enc` binary file on disk.
  - Added Electron IPC handlers (`save-attachment`, `load-attachment`, `delete-attachment`, `get-storage-info`).
  - Vault metadata stays featherweight and fast, loading attachments on demand.
- **Android Native APK**:
  - Uses the private, sandboxed app directory (`Directory.Data/attachments/`) with client-side AES-256-GCM encryption.

---

## 5. Build & Test Verification

- **TypeScript Compilation**: `npm run typecheck` &rarr; `tsc --noEmit` passed with 0 errors.
- **Vite Production Build**: `npm run build` &rarr; built production bundle in `< 3.0s`.
- **Git Remote Synchronization**: Pushed to `origin/main` (commit `3a6a5905`).

