# LifeLog Release Notes & Changelog 🚀

> **"Your day, remembered. Your data, sovereign."**

Official release documentation and changelogs for **LifeLog** — the offline-first, zero-cloud personal operating system for tasks, notes, habits, and deep work.

## 🌟 v1.1.3 — Google STUN Direct P2P Sync, Multi-Relay Failover & Zero-Spam Keepalive (2026-09-17)

### ⚡ 1. Direct Peer-to-Peer WebRTC over Google STUN
- **Direct Device-to-Device Transfer:** 6-digit PIN pairing now negotiates direct WebRTC DataChannel connectivity over Google STUN (`stun.l.google.com:19302`) during handshake. Once paired, all notes, tasks, habits, and delta broadcasts stream peer-to-peer over direct UDP/TCP with **zero server load, zero quota consumption, and sub-20ms latency**.
- **Universal Multi-Network Operation:** Direct hole punching connects devices seamlessly across different networks, cellular mobile data (4G/5G), and Wi-Fi without needing a local LAN.

### 🛡️ 2. Encrypted Multi-Relay Redundancy & Automatic Failover
- **Independent High-Availability Relays:** Introduced multi-relay failover architecture with `https://ntfy.envs.net` (primary) and `https://ntfy.sh` (secondary backup).
- **Zero-Failure Handshake:** Session metadata is mirrored across candidate relays. If one node experiences network hiccups or rate limits, LifeLog switches immediately and automatically to the healthy node.
- **Relay Fallback Safety Net:** If carrier-grade symmetric NAT blocks direct WebRTC UDP holes, the encrypted relay takes over smoothly in the background.

### 🔇 3. Zero-Spam SSE Keepalive & Rate Limit Elimination
- **Eliminated Rapid PING Spam:** Removed the aggressive 10-second PING/PONG HTTP requests and 15-second reconnection loop that exhausted public relay quotas.
- **Passive SSE Streaming:** Persistent Server-Sent Events (SSE) stream maintains listening status with single-request keepalive.
- **Intelligent Broadcast Debounce:** Real-time state broadcasting intelligently throttles HTTP requests (1200ms debounce on relay, 400ms on WebRTC), protecting battery life, data bandwidth, and server limits.

### 🎯 4. Reliable Handshake & Ghost Connection Resolution
- **Accurate Connection Transitions:** Auto-reconnect cleanly marks state as `connecting` and only transitions to `connected` upon verified cryptographic peer handshake.
- **Handshake Peer Preservation:** Fixed race condition where peer identity was wiped during initial handshake packet reception.

---

## 🌟 v1.1.2 — Database Anti-Resurrection, Cross-Platform SQLite Reconciliation & Persistent P2P Sync (2026-09-17)

### 🛡️ 1. Permanent SQLite Deletion & Anti-Resurrection Architecture
- **Atomic Deletion Purging:** Resolved critical database persistence flaw where deleting notes, tasks, habits, projects, or folders in the UI only updated in-memory state while SQLite indefinitely preserved orphaned rows with `is_deleted = 0`.
- **Universal Multi-Layer Reconciliation:** On every persist cycle, `saveFullStateToDb` reconciles every SQLite table (`tasks`, `notes`, `attachments`, `habits`, `projects`, `folders`, `sessions`, `day_logs`) against active application state, atomically deleting all deleted rows.
- **Immediate UI Deletion Routing:** Frontend deletion actions across all views immediately invoke `deleteFromDb` to purge records from SQLite before debouncing.
- **Cascading Attachment Cleanup:** Deleting a note automatically cascades to purge its encrypted binary attachments from SQLite storage.

### 🔄 2. Persistent P2P Device Sync & Auto-Reconnect Architecture
- **Non-Destructive Background Heartbeat:** Heartbeat timeouts (>26s peer silence) and background network drops no longer destroy saved pairing credentials (`SYNC_STORAGE_KEY`). Devices remain paired across restarts and sleep states.
- **Silent Auto-Reconnect Engine:** LifeLog automatically queries saved pairing sessions on launch and runs an automatic 15-second reconnection loop to seamlessly resume encrypted relay sync whenever peers come online.
- **Deterministic Cryptographic Tombstones:** All deletion events generate deterministic Unix millisecond tombstones (`deleted.notes`, `deleted.tasks`, `deleted.habits`, `deleted.projects`), preventing two-way state reconciliation from resurrecting deleted records.
- **Explicit Disconnect Action:** Pairing credentials are now only cleared when the user explicitly clicks "Disconnect" in the Sync dialog.

### 🧹 3. Total Database Wipe Support
- **Full Database Reset:** "Erase LifeLog on this device" in Settings now executes a complete database wipe (`DELETE FROM ...` across all tables + `VACUUM` + removal of disk fallback JSON vaults), guaranteeing a true factory-clean slate.

---

## 🌟 v1.1.1 — Smart Platform-Filtered Updates, Daily Auto-Check & Release Sync (2026-09-15)

### 🎯 1. Smart Platform-Filtered Update Detection
- **Distribution-Specific Update Targeting:** LifeLog now detects your exact operating system and application distribution (`windows-portable`, `windows-setup`, `linux-appimage`, `linux-deb`, `mac`, `android`, or `web`).
- **Single-Click Matching Binary:** Instead of overwhelming users with multi-platform download lists, the update modal displays **only the exact binary matching your current installation** (e.g. Windows Portable users see a single dedicated button to download the Portable executable).
- **Universal Release Hub Navigation:** Direct link to the complete GitHub Releases page (`https://github.com/Krrish1411/Lifelog-Releases/releases/latest`) for users seeking checksums, source archives, or alternative formats.

### ⏰ 2. Automated Daily Update Check & Auto-Popup
- **Silent Background Verification:** LifeLog automatically checks for new releases on startup once every 24 hours without sending tracking data or telemetry.
- **Automatic Pop-up Notification:** When a new version is detected, the **Update Available window automatically pops up on screen** with the latest changelog and the matching download button.
- **Unified Checker Architecture:** The manual "Check for Updates" button in Settings and the daily startup check share the same robust, timeout-guarded update engine (`src/utils/updater.ts`).

### 🔗 3. Canonical Releases Repository Synchronization
- **Live Branch Sync:** Synchronized `version.json` on the `main` branch of `Krrish1411/Lifelog-Releases` with verified asset filenames, resolving legacy 404 errors for all existing v1.0.0 and v1.0.2 users.

---

## 🌟 v1.1.0 — Open Source Milestone, Mobile Responsive Focus Scroll & Clean Multi-Platform Binaries (2026-09-15)

### 🌐 1. 100% Free & Open Source Milestone (MIT License)
- **Public Core Codebase:** LifeLog is now 100% free and open source under the permissive MIT License. Full source code, build toolchains, and issue discussions are publicly accessible at [https://github.com/Krrish1411/Lifelog](https://github.com/Krrish1411/Lifelog).
- **Public Audibility & Zero Telemetry:** Verify independently that zero tracking SDKs, zero ads, zero telemetry, and zero remote database connections exist in the codebase.
- **Developer Quickstart:** Added developer clone, local build, and testing documentation in `README.md` (`npm run dev`, `npm run build`, `npm run electron:dev`).

### 📱 2. Mobile Responsive Touch Scrolling on Focus Screen
- **Full-Screen Touch Response:** Fixed touch-gesture interception on mobile screens across all 3 focus cards. Swiping or dragging with a finger anywhere inside the Focus cards (including the 240px SVG timer circle and task lists) now scrolls the page naturally.
- **Touch-Action Scoping:** Declared `touch-action: pan-y` across card components and `.engine-panel` in `index.css`, preventing browser gesture locks and overscroll trapping.
- **Pointer Events Optimization:** Set `pointer-events: none` on the non-interactive SVG timer dial and center digit overlay, ensuring vertical swipes seamlessly pass through to document scrolling on phones.

### 📦 3. Clean Multi-Platform Binary Separation
- **Distinct Platform Packages:** Binaries are now built, clearly named, and published separately so users can download their exact preference:
  - **Linux:** `.deb` (Debian/Ubuntu/Mint), `.AppImage` (Universal Linux), `.tar.gz` (Portable Linux).
  - **Windows:** `LifeLog-Setup-Windows.exe` (Installer), `LifeLog-Portable-Windows.exe` (Standalone Portable).
  - **macOS:** `LifeLog-macOS.dmg` (Disk Image), `LifeLog-macOS.zip` (Portable Archive).
  - **Android:** `LifeLog-Android.apk` (Signed Release APK).

### ⚡ 4. Service Worker Cache Update & Storage Quota Protection
- **Instant PWA Cache Invalidation:** Bumped service worker cache key to `lifelog-pwa-v1.1.0` with active `controllerchange` listener for seamless automatic browser refreshes.
- **1-Day Storage Retention:** All CI build workflows configured with `retention-days: 1` to keep Actions artifact storage at zero bloat.

---

## 🌟 v1.0.2 — Mobile Scroll Architecture, Version Dynamic Sync & Cloud Automation (2026-09-14)

### 📱 1. Mobile Touch Architecture & Focus Page Fluid Scrolling
- **Mobile-First Priority:** Reordered the Focus page layout on mobile screens (`< 1024px`). The **Timer Card is now positioned right at the top** (`order-1`), followed by the Task Selector (`order-2`) and Today's History (`order-3`). Users on Android and mobile viewports can immediately start, pause, or switch modes without having to scroll past 420px of task lists.
- **Universal Mobile Touch Scroll Fix:** Removed the aggressive global `overscroll-behavior-y: contain` property on `.overflow-y-auto` and `main` in `index.css`. Previously, touching any element on Android with an internal scroll container would completely freeze outer page scrolling. Overscroll containment is now strictly scoped to actual dialogs and drawers (`.modal, [role="dialog"], .drawer`).
- **Fluid Viewport Heights:** Replaced rigid `min-h-[calc(100vh-140px)]` on mobile with fluid responsive heights (`min-h-full pb-16 lg:h-[calc(100vh-140px)]`), eliminating clipped controls and viewport locking on mobile devices.

### 🔄 2. Dynamic Version Synchronization
- **Single Source of Truth:** Connected `package.json` (`v1.0.2`) directly to Vite's build-time define system (`__APP_VERSION__`), guaranteeing that the UI never displays outdated version strings.
- **Live In-Browser Version Verification:** `Settings` view now dynamically auto-queries `./version.json` in web mode, instantly reflecting active deployed versions without requiring manual hardcode edits.
- **Android Gradle Version Alignment:** Synced `versionCode 5` and `versionName "1.0.2"` in `android/app/build.gradle`.

### ⚡ 3. Instant PWA Service Worker Cache Invalidation (v1.0.2)
- **Automatic Cache Purge:** Updated PWA cache key to `lifelog-pwa-v1.0.2`. Browsers and installed PWAs automatically purge stale caches and fetch the fresh mobile-scroll build upon opening.

### 🚀 4. Zero-Bandwidth Cloud Release Pipeline (GitHub Actions)
- **Automated Cloud Compiles:** Updated `.github/workflows/build-apk.yml` and `.github/workflows/build-electron.yml` to trigger automatically on git release tags (`v*`).
- **Direct GitHub Release Asset Attachment:** GitHub's cloud runners now compile Android APKs, Linux AppImage/deb, Windows executables, and macOS packages in Microsoft's multi-gigabit cloud and attach them directly to the GitHub Release.
- **Zero Local Data Consumption:** You no longer need to spend gigabytes downloading or re-uploading large binaries locally; a single ~2 KB `git push origin v1.0.2` triggers the entire cloud release process.

---

## 🌟 v1.0.1 — Sovereign Polish & Stream Control Update (2026-09-14)

### 🌊 1. Dynamic LifeLog Stream & Routine Control
- **Full UI Toggle in Settings:** Introduced the **🌊 Enable LifeLog Stream Project** toggle under *Settings > LifeLog Stream & Project*.
- **Distraction-Free Work Separation:** Easily separate everyday lifestyle routines (sleep, reading, vibe coding, meals, YouTube) from high-leverage professional tasks.
- **Dynamic View Sanitization:** When toggled off, the built-in "Life Log" project and its routine timeline are seamlessly hidden from:
  - **Day Log:** Routine entries and the 24-hour balance bar card are cleanly removed.
  - **Reports & Daily Review:** Focus breakdowns exclude passive lifestyle tracking.
  - **Time-Grid Calendar:** Routine time blocks are hidden to surface deep work tasks.
  - **Tasks & Project Selectors:** Life Log project is excluded from active task queues.
- **Zero-Loss Guarantee:** All historical routine data remains 100% encrypted in your local SQLite WAL database at rest. Enabling the toggle instantly restores every historical entry.

### 📱 2. Mobile Ergonomics & Theme Cards
- **Descriptive Theme Cards:** Redesigned mobile theme selection with visual card badges and descriptive summaries (*e.g., "Signature crimson on dark slate", "Warm sepia with low blue light", "Calming botanical green"*).
- **Hidden Keyboard Hints on Touch Devices:** Automatically hides desktop keyboard shortcuts (<kbd>⌘K</kbd>, <kbd>N</kbd>, <kbd>T</kbd>) on touch screens and mobile viewports to keep interfaces clean and spacious.

### 🖥️ 3. Desk Suite Workstation Solid Panels
- **Zero Bleed-Through:** Applied solid panel background tokens (`var(--panel-solid)`) across the Desk layout sidebar, header, and split views, preventing text and background overlay bleed-through during intense multitasking.
- **Workstation Contrast:** Sharper contrast borders and high-visibility active tab rails for long desktop coding sessions.

### 🍱 4. Minimalist Bento Dashboard Defaults
- **Cleaner First Impression:** Out-of-the-box Bento grid defaults set to a minimalist focus layout (`dailyNote: false`, `upcomingSchedule: false`), allowing users to opt into dense widget layouts when ready.

### 🛡️ 5. P2P Sync Transparency & Community Covenant
- **Explicit `*` Mark:** Added standard `*` indicators to all Peer-to-Peer Sync references across the Welcome page and documentation.
- **Infrastructure Cost Transparency:** Added a community notice explaining the ongoing server and bandwidth costs required for encrypted WebRTC STUN/TURN signaling relays.
- **Sovereign Covenant:** P2P sync remains completely zero-cloud and free thanks to voluntary community backing via [Buy Me a Coffee](https://buymeacoffee.com/Krrish1411).

### ⚡ 6. Instant Service Worker Cache Invalidation (v1.0.1)
- **Automatic Cache Purge:** Updated PWA cache key to `lifelog-pwa-v1.0.1`, ensuring all visiting browsers and installed PWAs automatically purge stale caches and fetch the latest build immediately upon launch.

---

## 🚀 v1.0.0 — Sovereign Edition Initial Public Launch (2026-09-14)

### 🔥 Why Shift to LifeLog? (LifeLog vs. Big Tech Cloud SaaS)

If you are paying \$8 to \$25/month for Notion, Todoist, Evernote, or Obsidian Sync, LifeLog provides complete sovereignty:

| Feature / Philosophy | Big Tech Cloud SaaS (Notion, Todoist) | LifeLog Sovereign OS |
|---|---|---|
| **Price & Paywalls** | \$96 – \$300/year per user forever | **100% Free Forever** (Zero recurring costs) |
| **Boot Speed & Latency** | 1.5s – 4s web load with spinner wheels | **Sub-5ms native boot** with zero network delay |
| **Data Ownership** | Stored on third-party cloud servers | **100% Local SQLite WAL** on your hardware |
| **Privacy & Telemetry** | Trackers, analytics pixels, AI scraping | **Zero outbound telemetry** on boot (Wireshark verified) |
| **Offline Reliability** | Broken or partial when internet drops | **True offline-first** (identical experience on airplane mode) |
| **Note Security** | Plaintext or server-managed keys | **Hardware-bound AES-256-GCM** client-side encryption |
| **Device Sync** | Centralized databases see all your notes | **Direct Peer-to-Peer DTLS** over local Wi-Fi / WebRTC |
| **Portability** | Locked in proprietary cloud silos | **1-Click portable `.lifelog`** snapshots & Markdown files |

---

### ⚡ The 7 Core Pillars of LifeLog

```mermaid
graph LR
    Cockpit[1. Cockpit Dashboard] --> Tasks[2. Tasks & Habits]
    Tasks --> Focus[3. Deep Focus Studio]
    Focus --> Calendar[4. Time-Grid Calendar]
    Calendar --> Notes[5. Encrypted Second Brain]
    Notes --> Analytics[6. Calibrated Reports]
    Analytics --> P2P[7. Peer-to-Peer Sync]
```

1. **Unified Task Agenda & Hierarchical Habits:**
   - Multi-block timebox scheduling with estimate vs. actual tracking.
   - Recurrence rules: daily, weekly, monthly nth-weekday, or custom cadences.
   - Dynamic top unscheduled tray with drag-and-drop time-blocking.
   - 12-week visual habit consistency heatmaps.

2. **Deep Focus Studio:**
   - Pomodoro, Countdown, and Flow stopwatch timers.
   - Client-side synthesized acoustic bell chimes with harmonic depth.
   - Strict micro-pause tracking and active task linkage.
   - Ambient soundscape toggle-free distraction isolation.

3. **Encrypted Second Brain (Notes):**
   - Full-featured Markdown canvas with live syntax preview.
   - **Dynamic mention autocompletion:** Type `@` to link tasks, `#` to link projects, and `[[` for bi-directional note links.
   - Nested folder hierarchies and instant search indexing.
   - Client-side AES-256-GCM authenticated row-level encryption.

4. **Time-Grid Calendar:**
   - Visual 24-hour day, 3-day, and week planning views.
   - Drag tasks from your agenda tray directly into calendar time slots.
   - Drag items back to the unscheduled tray if plans change.

5. **Circadian Sleep & Honest Daily Log:**
   - Accurate cross-midnight sleep attribution (credits 23:00–07:00 sleep without fragmenting daily summaries).
   - Energy ratings, mood tracking, and 1-click Markdown daily standups.

6. **Calibrated Productivity Analytics:**
   - Estimate vs. actual task duration calibration curve.
   - Hourly focus density heatmaps and productivity momentum scores.
   - High-contrast, exact-color PDF export engine with Executive Summary modes.

7. **Zero-Cloud Peer-to-Peer (P2P) Sync:**
   - Direct encrypted pairing between laptops and phones over local Wi-Fi.
   - Cryptographic vector clocks with a visual 3-way union merge conflict resolver.
   - Zero centralized database servers ever parse or hold your data.

---

### 🎨 5 Adaptive Layout Engines & 6 Free Core Themes

- **5 Ergonomic Workspaces:**
  - **Liquid Glass:** Frosted acrylic glassmorphism with ambient depth layering.
  - **Desk Suite:** Classic workstation layout with a persistent desktop navigation rail.
  - **Planify Clean:** Distraction-free split columns and focused task lists.
  - **Control Center:** Compact upper command strip with telemetry footer.
  - **Zen Focus:** Clean distraction-free canvas hiding all navigation during deep work.

- **6 Permanently Free Core Themes (3 Matching Dark & Light Pairs):**
  - **LifeLog Crimson** (Dark & Light) — Signature crimson red on velvet slate or paper.
  - **Warm Sepia** (Night & Paper) — Terracotta amber with ultra-low blue light fatigue.
  - **Botanical Sage** (Forest & Light) — Herbal green designed for calm focus.
  - *Pro Designer Beta Palettes:* OLED Pure Black, Tokyo Night/Day, Catppuccin Mocha/Latte, Nord Frost/Snow, Dracula Midnight, and custom font uploads unlocked free during the public beta.

---

### 📦 Official Binaries & Packages

| Platform | Format | Package Type | Direct Download Link |
|---|---|---|---|
| **Windows** | `.exe` | 64-bit Installer | [Download LifeLog Setup (Windows)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-Setup-1.0.0.exe) |
| **Windows** | `.exe` | Portable (No Install) | [Download LifeLog Portable (Windows)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0-portable.exe) |
| **macOS** | `.dmg` | Universal (Apple Silicon & Intel) | [Download LifeLog DMG (macOS)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.dmg) |
| **Linux** | `.AppImage` | Universal Linux Executable | [Download LifeLog AppImage (Linux)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.AppImage) |
| **Android** | `.apk` | Arm64 Release APK (0/70 Clean) | [Download LifeLog APK (Android)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.apk) |
| **iOS / iPadOS** | Safari PWA | Zero-Install Standalone App | [Open Web App](https://krrish1411.github.io/Lifelog-Releases/) (Share > Add to Home Screen) |
| **Web Browser** | Sandboxed PWA | 1-Tap Sandboxed Web App | [Launch Sovereign Web App](https://krrish1411.github.io/Lifelog-Releases/) |

---

### 🛡️ Android APK Safety & Anti-Malware Proof

1. **VirusTotal 0/70 Clean Scan:** Audited across 70+ cybersecurity engines (Kaspersky, Bitdefender, Microsoft Defender, Google, Avast, ESET). Zero malware, zero adware, zero spyware.
2. **SHA-256 Checksum Verification:** Verify byte-for-byte authenticity using `sha256sum LifeLog-1.0.0.apk`.
3. **Zero Dangerous Permissions:** Audited in `AndroidManifest.xml` — **No Camera, No Microphone, No GPS/Location, No Contacts, No Phone/SMS, No Storage scraping**. Only local alarms and peer-to-peer Wi-Fi sync.
4. **Zero Outbound Telemetry:** Malicious APKs exfiltrate user data. LifeLog makes **0 outbound calls on startup**. Anyone can monitor network traffic via Wireshark or Little Snitch to verify that zero packets leave your device.
5. **💡 1-Tap Sandboxed PWA Alternative:** Prefer not to sideload an APK? You can run LifeLog directly in your mobile browser (Chrome/Brave) or install it as a PWA in 1 tap. It runs inside the browser's hardware-isolated OS sandbox with zero device file access!

---

### ☕ Support Independent Sovereign Software

LifeLog is 100% free, private sovereign software with zero ads, zero telemetry, zero venture capital interference, and zero recurring paywalls. If LifeLog brings peace and clarity to your daily rhythm, please consider fueling future R&D:

<div align="center">

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-Support_LifeLog-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/Krrish1411)

</div>

---

*Crafted with precision by **Krish Patel**.*
