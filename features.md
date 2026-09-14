# LifeLog v1.0 Sovereign Edition — Comprehensive Feature & Architecture Specification

> **LifeLog** is a personal, offline-first, mathematically private productivity operating system crafted with precision by **Krish Patel**.  
> This document provides an exhaustive reference of every architectural subsystem, view, layout engine, data model, and algorithm powering LifeLog v1.0.

---

## Table of Contents
1. [Core Architectural Principles](#1-core-architectural-principles)
2. [Data Storage & Cryptographic Engine](#2-data-storage--cryptographic-engine)
3. [The 8 Core Primary Views](#3-the-8-core-primary-views)
   - [Cockpit Dashboard](#31-cockpit-dashboard)
   - [Tasks & Projects](#32-tasks--projects)
   - [Deep Focus Studio](#33-deep-focus-studio)
   - [Time-Grid Calendar](#34-time-grid-calendar)
   - [Habits Tracker & Heatmaps](#35-habits-tracker--heatmaps)
   - [Encrypted Second Brain (Notes)](#36-encrypted-second-brain-notes)
   - [Calibrated Analytics & Reports](#37-calibrated-analytics--reports)
   - [Honest Daily Log & Circadian Sleep](#38-honest-daily-log--circadian-sleep)
4. [The 5 Adaptive Visual Layout Engines](#4-the-5-adaptive-visual-layout-engines)
5. [Keyboard Navigation & Universal Command Palette](#5-keyboard-navigation--universal-command-palette)
6. [Decentralized P2P DTLS Sync Engine](#6-decentralized-p2p-dtls-sync-engine)
7. [In-App Software Updates & Support Prompts](#7-in-app-software-updates--support-prompts)
8. [Guided Onboarding & Seed Vault Purging](#8-guided-onboarding--seed-vault-purging)

---

## 1. Core Architectural Principles

- **100% Offline-First Sovereignty:**  
  LifeLog requires zero internet connection to function. It never requires an email login, account signup, or cloud database connection.
- **Zero External Telemetry:**  
  The codebase contains zero third-party analytics libraries (no Google Analytics, Sentry, Mixpanel, or Facebook Pixel). The network interface is completely dormant on launch.
- **Sub-5 Millisecond Cold Boot:**  
  Data models are restored synchronously or near-instantaneously from local storage, eliminating splash screen lag and spinners.
- **Device-Bound Cryptography:**  
  Every device generates a unique cryptographic key upon first boot, derived from hardware randomness and stored securely in local keystores.

---

## 2. Data Storage & Cryptographic Engine

### Desktop (Electron): Native SQLite with WAL Mode
- Powered by Node.js native `node:sqlite` (`DatabaseSync`).
- Configured with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA synchronous = NORMAL;` to guarantee instantaneous sub-millisecond atomic transactions and crash resilience.
- Normalized schema across 10 tables (`tasks`, `subtasks`, `projects`, `habits`, `habit_completions`, `notes`, `note_folders`, `sessions`, `day_logs`, `settings_meta`).
- Automated, fast B-Tree indexing on primary and foreign keys (`projectId`, `taskId`, `due`, `startedAt`, `folderId`).
- Native atomic snapshots via `VACUUM INTO` for portable `.lifelog` backups.

### Web & Mobile (Capacitor Android): WebAssembly SQLite + IndexedDB
- Powered by `sql.js` (compiled WebAssembly SQLite).
- Maintains the exact same relational schema and SQL dialect as desktop Electron.
- In-memory database changes are debounced and committed atomically to IndexedDB (`LifeLogSQLiteStorage`).

### Note Encryption (AES-256-GCM)
- Note bodies are stored as encrypted byte envelopes containing `{ iv, salt, ciphertext }`.
- Key derivation uses PBKDF2 with SHA-256 and 100,000 iterations.
- Decryption occurs entirely in memory within the client device. Plaintext never touches raw storage unencrypted.

---

## 3. The 8 Core Primary Views

### 3.1 Cockpit Dashboard (`src/views/Cockpit.tsx`)
- **Hourly Personalized Greetings:** Dynamically adapts based on local hour and user profile name ("Good morning", "Good afternoon", "Good evening").
- **Circadian Day Budget Bar:** 24-hour visual progress indicator partitioning time into Sleep (indigo), Deep Focus (crimson), Habits/Routines (emerald), and Unallocated time.
- **Today Priorities Stream:** Shows overdue, scheduled, and high-priority tasks due today with quick-complete checkboxes and focus timer triggers.
- **Live Focus Widget:** If a focus session is running, displays an active pulsing stopwatch/countdown widget directly on the cockpit canvas.
- **Energy & Mood Snapshot:** One-tap logging for daily energy ratings (1 to 5 stars) and mood emojis.

### 3.2 Tasks & Projects (`src/views/Tasks.tsx`)
- **Hierarchical Project Trees:** Color-coded projects with custom emojis, task counts, and completion percentages.
- **Nested Subtasks & Checklists:** Infinite-depth subtasks with individual done states and completion timestamps.
- **Priority Matrix:** 4 priority tiers (`urgent`, `high`, `medium`, `low`) with distinct visual badges.
- **Recurrence Engine:** Flexible recurring rules:
  - Daily (`interval` days)
  - Weekly (`byWeekday` arrays)
  - Monthly by exact date (e.g. 1st of every month)
  - Monthly by nth-weekday (e.g. 2nd Tuesday of every month)
- **Time Estimates:** Configurable estimate in minutes (`estimateMin`), which feeds directly into retrospective calibration reports.
- **Dynamic Mentions:** Type `@`, `#`, or `[` in task notes to trigger live autocomplete dropdowns.

### 3.3 Deep Focus Studio (`src/views/Focus.tsx`)
- **3 Operating Modes:**
  1. *Pomodoro:* Standard 25-minute focus blocks with automated 5-minute break transitions and customizable intervals.
  2. *Countdown:* Goal-driven timer for a specific duration (1 to 180 minutes).
  3. *Flow:* Open-ended stopwatch for uninterrupted creative momentum.
- **Pause Duration Auditing:** Every pause event is timestamped (`at`, `resumeAt`). Pause time is separated from genuine focus time to prevent false productivity statistics.
- **Built-In Soundscapes:** Client-side synthesized audio generators:
  - Rain & Thunderstorm
  - Ocean Waves
  - White, Pink, and Brown Noise
  - Alpha & Theta Binaural Beats
- **Spacebar Control:** Tap Spacebar to pause or resume active focus blocks without touching the mouse.

### 3.4 Time-Grid Calendar (`src/views/Calendar.tsx`)
- **Interactive Multi-Day Grid:** Day, 3-Day, and Week views with 15-minute time-slot snapping.
- **Drag-and-Drop Task Scheduling:**
  - Drag tasks from the top unscheduled tray directly onto the 24-hour canvas.
  - Drag tasks back to the top tray to unblock and restore them to unscheduled status.
- **Habit Time Placement:** Habit blocks can be scheduled into specific hours. Clicking a habit on the calendar toggles completion on the spot.
- **Current Time Indicator ("Now Line"):** Real-time horizontal red marker with pulsing indicator reflecting the exact minute of the day.

### 3.5 Habits Tracker & Heatmaps (`src/views/Habits.tsx`)
- **12-Week Density Heatmaps:** GitHub-style weekly grid tracking completion intensity over the last 84 days.
- **Dual Streak Counters:**
  - *Current Streak:* Active consecutive days or weeks completed.
  - *Best Streak:* All-time highest unbroken consistency record.
- **Target Days per Week:** Flexible weekly goals (e.g. 3 days/week for running vs. 7 days/week for meditation).
- **Today Projection:** Option in Settings to project active habits directly into the Today tasks stream.

### 3.6 Encrypted Second Brain (Notes) (`src/views/Notes.tsx`)
- **Full Markdown Canvas:** Headers, blockquotes, code blocks with syntax highlighting, bullet lists, and interactive checkboxes (`- [ ]`).
- **Dynamic Autocomplete Dropdown (`MentionAutocomplete.tsx`):**
  - Type `@` to dynamically link tasks: `[Task Title](task:id)`.
  - Type `#` to dynamically link projects: `[#Project](project:id)`.
  - Type `[` to dynamically link other notes: `[[Note Title]]`.
- **Folder Tree & Hierarchy:** Organize notes into custom folders (e.g. Guides & Principles, Daily Log, Ideas).
- **Attachments & Media:** Embedded local files and images stored securely within the local vault.
- **Hardware-Key Encryption:** All note bodies encrypted with AES-256-GCM before write.

### 3.7 Calibrated Analytics & Reports (`src/views/Reports.tsx`)
- **Estimate vs. Actual Calibration:** Compares planned task minutes with genuine logged focus time. Calculates an accuracy ratio so users learn their actual work velocity.
- **Cognitive Energy & Fatigue Curves:** Visualizes how daily focus output correlates with self-reported energy ratings.
- **Hourly Heatmap:** Highlights which hours of the day (morning, afternoon, night) yield the highest deep-work focus.
- **Lag-Free PDF Export:**
  - Modal offering selective task bundling (e.g. Summary + Top 5 Tasks).
  - Enforces `@media print` exact color reproduction and unclipped page layout.

### 3.8 Honest Daily Log & Circadian Sleep (`src/views/DailyLog.tsx`)
- **Cross-Midnight Sleep Attribution:** Sleep logged from 23:00 to 07:00 automatically credits 1 hour to yesterday and 7 hours to today without splitting or corrupting tasks.
- **Daily Reflection & Standup:** Compile completed tasks, focus minutes, and notes into clean Markdown formatted for Slack, Discord, or personal archives.

---

## 4. The 5 Adaptive Visual Layout Engines

LifeLog features 5 switchable ergonomic layouts configured via `Settings > Appearance` or hotkey:

1. **Liquid Glass (Modern OS):** Frosted acrylic glassmorphism with dynamic ambient light refraction, depth blurring, and floating control bars.
2. **Desk Suite (Workstation):** Classic workstation layout with persistent side navigation rail, information density, and structured panel divides.
3. **Planify Clean (Todoist-Inspired):** Clean split columns, minimalist whitespace, and distraction-free task lists.
4. **Control Center:** Compact upper command strip with telemetry footer and rapid view switches.
5. **Zen Focus:** Ultra-minimalist canvas that hides all navigation chrome during active work, displaying only your primary task and active timer.

---

## 5. Keyboard Navigation & Universal Command Palette

### Universal Command Palette (`Ctrl + K` / `Cmd + K`)
- Instant omni-search across all tasks, projects, notes, and navigation views.
- Fuzzy filtering with keyboard navigation (`↑`, `↓`, `Enter`).

### Single-Key Hotkeys (Active outside text fields)
| Shortcut | Action |
|:---:|:---|
| `1` | Jump to Cockpit Dashboard |
| `2` | Jump to Tasks & Projects |
| `3` | Jump to Deep Focus Stage |
| `4` | Jump to Time-Grid Calendar |
| `5` | Jump to Habits Tracker |
| `6` | Jump to Notes & Second Brain |
| `7` | Jump to Reports & Analytics |
| `8` | Jump to Daily Log & Reflection |
| `9` | Jump to Settings |
| `Space` | Start / Pause Active Focus Timer |
| `?` | Show Shortcuts Help Overlay |

*All keyboard shortcuts can be customized and remapped in **Settings > General**.*

---

## 6. Decentralized P2P DTLS Sync Engine

- **Pure WebRTC DataChannels:** Synchronizes data directly between devices over local Wi-Fi.
- **Zero Cloud Servers:** Eliminates central databases. Data packets travel directly between peer devices.
- **Independent Device Keys:** Each paired device maintains its own sovereign cryptographic key. Keys are never transmitted over the network.
- **Conflict Resolution Modal (`DiffConflictModal.tsx`):**
  - Rendered via a top-level body portal (`z-[9999]`) to guarantee zero CSS clipping.
  - Presents side-by-side device metrics (`Local 💻` vs `Peer 📱`).
  - 3 merge resolutions:
    1. *Smart 3-Way Union (Lossless):* Merges newer edits from both devices without losing uncompleted tasks.
    2. *Keep This Device:* Overwrites peer with local database state.
    3. *Accept Peer Device:* Overwrites local state with incoming peer database.

---

## 7. In-App Software Updates & Support Prompts

### On-Demand Update Checker (`Settings > General`)
- Fetches `https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json`.
- Strict 5-second timeout via `AbortController`.
- Zero automatic background queries; strictly user-initiated.
- Shows release date, changelog bullets, and direct platform downloads (`.exe`, `.dmg`, `.AppImage`, `.apk`).

### Milestone Supporter Prompt (`SupportCoffeeModal.tsx`)
- Triggers only after genuine user milestones:
  - `completedTasksCount >= 10` OR `totalFocusMinutes >= 300` (5 hours of deep work).
- Snoozes for 7 days if postponed ("Remind Me in a Week").
- Can be permanently disabled via "Don't Show Again" or the toggle in **Settings > General**.

---

## 8. Guided Onboarding & Seed Vault Purging

### Educational Onboarding Data (`src/data/seed.ts`)
- Replaces generic placeholder tasks with intuitive tutorial workflows:
  - Setup checklist with subtasks.
  - Dedicated task to explore Notes & Second Brain.
  - Interactive Pomodoro and Calendar scheduling tasks.
- 3 structured Markdown notes in `Guides & Principles`:
  1. *Welcome to LifeLog: The Sovereign Workspace Guide*
  2. *Power User Guide: Mentions, Wiki-Links & Shortcuts*
  3. *Zero-Cloud Architecture & Cryptographic Sovereignty*

### Clean Vault Purge (`cleanSeed.ts`)
- All seed task titles, project IDs, and note titles are registered in `cleanSeed.ts`.
- Users can click "Purge Demo Data" in Settings anytime to leave a clean, blank slate while preserving any personal items they created.

---
*LifeLog v1.0.0 Sovereign Edition · Built for focus, built for privacy, built for life.*
