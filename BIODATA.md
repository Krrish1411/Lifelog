# LIFELOG SOVEREIGN OPERATING SYSTEM
## Official System Manifesto & Architectural Biodata

> **"Privacy is not a feature; it is an unalienable sovereignty."**  
> **Engineered & Crafted with meticulous precision by Krish Patel.**  
> **Patronage & Coffee:** [buymeacoffee.com/Krrish1411](https://www.buymeacoffee.com/Krrish1411)

---

## 1. Executive Identity & System Vision

**LifeLog** is an industrial-grade, local-first sovereign productivity operating system designed to unify deep work, habit formation, time-tracking, encrypted journaling, and daily circadian balance into a single, cohesive, zero-latency desktop and mobile interface.

Unlike traditional productivity SaaS applications that harvest user telemetry, monetize attention, require perpetual subscriptions, and lock data inside remote proprietary databases, LifeLog operates under a strict **Zero-Cloud, Zero-Telemetry, Cryptographic Sovereignty** architecture:

1. **Your Hardware is Your Server**: Every byte of state resides exclusively on your local device (IndexedDB with LocalStorage fallback).
2. **Cryptographic Secrecy by Default**: App data is encrypted at rest via hardware-accelerated **AES-256-GCM** using keys generated via `window.crypto.subtle`. Master password export packages are hardened with **PBKDF2** (SHA-256, 150,000 iterations).
3. **Pure Zero-Server Synchronization**: Multi-device state synchronization is accomplished via direct **WebRTC Peer-to-Peer** encrypted data channels using dynamic QR codes or session ticket exchange. No centralized relay server ever inspects, stores, or indexes your work.
4. **Permanent Digital Lookback**: Every session records exact `startedAt`, `endedAt`, and interruption intervals, ensuring that any day in your lifetime can be reconstructed down to the minute.

---

## 2. Architectural Blueprint & Technology Stack

LifeLog is constructed using an ultra-optimized modern TypeScript frontend architecture:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         LIFELOG CLIENT ARCHITECTURE                            │
├────────────────────────────────────────────────────────────────────────────────┤
│  Core Engine: React 18 + TypeScript 5.7 + Vite + Tailwind CSS v4               │
│  Persistence: IndexedDB (idb-keyval) + LocalStorage Vault Fallback             │
│  Security:    Web Crypto API (SubtleCrypto) • AES-256-GCM • PBKDF2-SHA-256    │
│  Networking:  Pure WebRTC DataChannel (Direct P2P Mesh) + QR Signaling        │
│  Acoustics:   Procedural Web Audio API Sound Synthesizer (0 External Assets)   │
│  Mobile:      Capacitor Android Core + Dynamic Safe Area & Notch Insets        │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Source Directory Taxonomy

```
Lifelog-main/
├── BIODATA.md                         # This comprehensive system manifesto
├── PROJECT.md                         # Project roadmap and architecture overview
├── PENDING-FEATURES.md                # Commercial Pro & deferred feature specifications
├── capacitor.config.ts                # Capacitor native Android configuration
├── vite.config.ts                     # Optimized Vite build and alias pipeline
├── src/
│   ├── main.tsx                       # React root entry & container bootstrap
│   ├── App.tsx                        # Global application provider & Shell mounting
│   ├── index.css                      # Tailwind v4 theme engine, glass styling, print CSS
│   ├── types.ts                       # Single source of truth: all models & default settings
│   ├── store.tsx                      # Context store: CRDT merge, encrypted save, audio triggers
│   ├── components/
│   │   ├── Shell.tsx                  # 5 layout engines, navigation rails, live clock, status bars
│   │   ├── TaskDialog.tsx             # Task modal: priority, tags, recurrence, timeblocks, subtasks
│   │   ├── SyncDialog.tsx             # P2P WebRTC pairing, QR generator/scanner, Pro roadmaps
│   │   ├── DiffConflictModal.tsx      # 3-way visual CRDT diff resolver (Local vs Remote replica)
│   │   ├── OnboardingTourModal.tsx    # 5-slide interactive walkthrough of the sovereign OS
│   │   └── ui.tsx                     # Primitives: Btn, Modal, Toggle, Seg, ColorPicker, TagInput
│   ├── views/
│   │   ├── Dashboard.tsx              # Daily balance bar, energy tracker, plan queue, On-This-Day
│   │   ├── Tasks.tsx                  # Project matrices, tag filters, habit projections, search
│   │   ├── Focus.tsx                  # Deep focus timer (Pomodoro/Countdown/Flow), running state
│   │   ├── Calendar.tsx               # Day/3-day/week/month grid, drag timeblocking, habit lines
│   │   ├── Habits.tsx                 # 12-week streak grid, historical backfill, streak analytics
│   │   ├── Notes.tsx                  # Encrypted notebook, folders, bi-directional [[wiki]] links
│   │   ├── DayLog.tsx                 # 24h chronological timeline, cross-midnight sleep, standup
│   │   ├── Reports.tsx                # Custom ranges, time-of-day histograms, PDF export
│   │   └── Settings.tsx               # Theme studio, audio soundboard, vault management, Pro previews
│   └── utils/
│       ├── core.ts                    # Recurrence engine, focus streak math, WCAG contrast checks
│       ├── crypto.ts                  # Device key derivation, envelope encryption, password backups
│       ├── audio.ts                   # Procedural Web Audio chimes, clicks, and crystal arpeggios
│       ├── markdown.tsx               # Token parser for [[Wiki]], #Project, and @Task mentions
│       ├── cleanSeed.ts               # Demo data sanitizer & seed generator
│       ├── idb.ts                     # IndexedDB asynchronous storage wrapper
│       └── native.ts                  # Android Capacitor haptics, alarms, and permission guards
```

---

## 3. The 5 Visual Layout Engines

LifeLog features 5 purpose-built visual layout engines, each selectable at will in `Settings > Appearance > Layout Engine`:

### 1. Glassmorphic Engine (`glass`)
- **Aesthetic**: Translucent crystalline glass panels with high-saturate backdrop blur (`backdrop-blur-xl`).
- **Dynamic Lighting**: Specular sweep reflections on card hover (`translate3d` GPU-accelerated sheens), custom edge gradient borders, and multi-layer ambient backdrop depth.
- **Form Factor**: Designed for high-resolution displays, ultra-widescreens, and immersive desktop setups.

### 2. Control Center Engine (`control`)
- **Aesthetic**: High-density tactical telemetry interface inspired by aviation heads-up displays and industrial control dashboards.
- **Data Density**: Compact margins, tabular numeric readouts, integrated telemetry counters, and rapid toggle switches.
- **Form Factor**: Preferred by power users, engineers, and financial analysts tracking multiple concurrent projects.

### 3. Desk Station Engine (`desk`)
- **Aesthetic**: Multi-column executive cockpit featuring a persistent left dock rail, an expansive central canvas, and a dedicated right status bar.
- **Ergonomics**: Minimizes modal transitions by keeping projects, active timers, and incoming task queues simultaneously visible.
- **Form Factor**: Optimized for dual-monitor workstation environments.

### 4. Planify Clean Engine (`planify`)
- **Aesthetic**: Minimalist Scandinavian productivity aesthetic inspired by calm analog paper notebooks.
- **Zen Typography**: Generous whitespace, soft contrast separators, subtle typography, and distraction-free content cards.
- **Form Factor**: Ideal for writing, contemplation, long-term strategic reviews, and cognitive decompression.

### 5. Zen Focus Engine (`zen`)
- **Aesthetic**: Radical cognitive minimalism. Hides all secondary navigational elements, badges, metrics, and sidebars.
- **Flow State**: Centers exclusively on the current active task and real-time pomodoro countdown.
- **Form Factor**: High-urgency sprint sessions, deadline execution, and ADHD-friendly distraction elimination.

---

## 4. The 12 Designer Themes & WCAG AAA Contrast Engine

LifeLog includes 12 handcrafted designer color themes covering both light and dark spectrums:

| Theme ID | Palette Description | Accents & Characteristics |
| :--- | :--- | :--- |
| `crimson` | **Crimson Sovereign** (Default) | Deep volcanic slate `#07090e` paired with vivid ruby `#ef4444`. |
| `nord` | **Nord Arctic Frost** | Arctic blue-grey `#2e3440` paired with crisp glacial cyan `#88c0d0`. |
| `tokyo` | **Tokyo Night Neon** | Japanese midnight ink `#1a1b26` illuminated by electric lavender `#bb9af7`. |
| `dracula` | **Dracula Gothic** | Iconic vampire charcoal `#282a36` punctuated by fluorescent orchid `#bd93f9`. |
| `cyberpunk`| **Cyberpunk Neon Matrix** | Synthetic carbon black `#0b0e14` glowing with high-voltage emerald `#00ff9f`. |
| `obsidian` | **Obsidian Pure Monochrome**| True OLED zero-black `#000000` accented with surgical titanium white. |
| `amber` | **Amber Terminal Warmth** | Vintage CRT phosphorous warmth `#18120c` accented with amber glow `#f59e0b`. |
| `emerald` | **Emerald Deep Forest** | Organic nocturnal pine `#0a1410` balanced with soothing jade `#10b981`. |
| `solarized`| **Solarized Precision Dark**| Classic laboratory cyan-black `#002b36` accented with brass ochre `#b58900`. |
| `paper` | **Swiss Paper White (Light)** | Editorial crisp alabaster `#ffffff` with high-contrast jet typography `#0f172a`. |
| `latte` | **Warm Latte Ochre (Light)** | Gentle cream linen `#faf8f5` with warm chestnut brown `#78350f`. |
| `rose` | **Rose Quartz Pastel (Light)** | Modern blush porcelain `#fff1f2` accented with deep wine magenta `#be123c`. |

### Dynamic WCAG AAA Luminance Engine (`ensureContrast`)
LifeLog guarantees absolute legibility across custom user color palettes. When a custom accent color is selected in the color picker:
1. The relative luminance is calculated via the WCAG 2.1 formula:  
   $$L = 0.2126 \times R_{\text{lin}} + 0.7152 \times G_{\text{lin}} + 0.0722 \times B_{\text{lin}}$$
2. The contrast ratio against the background is computed.
3. If contrast falls below $4.5:1$ (normal text) or $7.0:1$ (AAA standard), the `ensureContrast()` algorithm automatically shifts luminance up or down until certified accessibility is achieved.

---

## 5. 24-Hour Balance Engine & Cross-Midnight Sleep Physics

LifeLog treats **Time as an Invariable Physical Constraint**. Every day has precisely 1,440 minutes. The 24-Hour Balance Bar at the top of the Dashboard and Day Log enforces circadian equilibrium:

$$\text{24h Budget} = \text{Sleep} + \text{Deep Focus} + \text{Routine Maintenance} + \text{Free Surplus}$$

### Cross-Midnight Sleep Split Algorithm
Sleep rarely falls neatly within a single calendar day. LifeLog implements a dedicated cross-midnight allocation algorithm:
- When a sleep session is logged from **23:00 to 07:00**:
  - The **23:00 to 24:00 (1 hour)** slice is allocated to yesterday's circadian rest tally.
  - The **00:00 to 07:00 (7 hours)** slice is allocated to today's circadian rest tally.
- Days log calculations dynamically update both days' totals without duplicating session IDs.

### Life Log Routine Task Isolation
Routine items (Sleep, Meals, Exercise, Commute) are mapped under the internal `LIFE_LOG_PROJECT_ID`. They are excluded from the general task queue so daily habits and biological necessities never clutter active professional work queues.

---

## 6. Deep Focus Engine & Focus Day Streak Engine

The deep work module supports three distinct execution methodologies:
1. **Pomodoro Mode**: Configurable work sprint (default 25m), short break (5m), and long break (15m) intervals.
2. **Fixed Countdown Mode**: Arbitrary timer targeting a specific deliverable.
3. **Flow State Mode**: Open-ended stopwatch tracking unstructured deep concentration.

### Persistent Floating Mini-Timer
When navigating away from the Focus view to inspect notes or tasks, a floating glass mini-timer appears on the bottom-right corner of the screen:
- Displays live countdown, task name, and elapsed progress ring.
- Provides 1-click play/pause and stop controls.
- Automatically dismisses when returning to the full Focus stage.

### Focus Day Streak vs. Habit Streak
Unlike ordinary habit apps that inflate streaks on arbitrary daily clicks:
- **The Main Top-Bar Flame Badge strictly measures Focus Day Streak**: The consecutive days on which you logged at least one completed Pomodoro or Deep Focus session.
- Calculated via `calculateFocusDayStreak(state.sessions)`.
- Habit streaks are tracked independently in the Habits matrix.

---

## 7. Habit Projection & Audio Feedback Synthesis

### Habit Projection into Today Tasks
Users can activate `Settings > General > Project Habits into Today Tasks`:
- Active daily habits appear seamlessly inside the **Today** task queue.
- Checking a habit inside Tasks marks the habit done in the habit database, updates its streak, and plays the habit chime without having to leave the task view.
- Habits are also projected onto the 24-hour DayLog timeline and Calendar day view as non-blocking reminders.

### Pure Procedural Web Audio Synthesis
LifeLog uses **zero external MP3/WAV files**, guaranteeing instant sound playback with zero network delay and zero memory bloat:
1. **Habit Crystal Arpeggio (`playHabitChime`)**: A sparkling C-Major arpeggio synthesised with 4 overlapping sinusoidal oscillators:
   $$\text{C5 (523.25 Hz)} \rightarrow \text{E5 (659.25 Hz)} \rightarrow \text{G5 (783.99 Hz)} \rightarrow \text{C6 (1046.50 Hz)}$$
2. **Task Completion Pop (`playTaskToggleSound`)**: A short, tactile, acoustic transient click.
3. **Timer Toggle Sound (`playTimerToggleSound`)**: Dual-tone subtle click distinguishing pause from resume.
4. **Alarm Sound (`playNotificationAlarmSound`)**: Multi-harmonic bell chime designed to cut through background noise without causing auditory startle fatigue.

---

## 8. Encrypted Second Brain (Notes & Bi-Directional Wiki Links)

The LifeLog Notes engine acts as a personal wiki and encrypted research repository:
- **AES-256-GCM Hardware Encryption**: Every note's body is encrypted before serialization.
- **Bi-Directional Wiki Linking**:
  - `[[Note Title]]`: Links to another note. If clicked and the note does not exist, prompts to instantiate it instantly.
  - `#Project`: Links directly to filtered tasks in that project.
  - `@Task`: Opens the corresponding task dialog or pre-populates a new task.
- **Interactive Wiki Chips**: Rendered as clickable badges in markdown view.
- **Wiki References Tray**: A footer panel on every note displaying all connected backlinks and tasks.

---

## 9. Zero-Cloud P2P Sync & 3-Way Conflict Diff Resolver

LifeLog provides true serverless synchronization across laptops, desktops, and mobile phones:

### 1. WebRTC DataChannel Direct Pairing
- Direct peer-to-peer connection established via dynamic QR codes or copyable SDP session tickets.
- Data flows directly over local Wi-Fi or peer-to-peer WebRTC connections.

### 2. CRDT Tombstone State Architecture
- Deletions are tracked using tombstones (`deletedAt: number`) so deletions reliably propagate to peer devices rather than resurrecting deleted records.

### 3. Visual 3-Way Conflict Diff Resolver (`DiffConflictModal`)
When two devices have modified the same tasks, notes, or habits while offline:
- LifeLog computes a visual 3-way diff between Local Replica and Remote Peer.
- Displays added, modified, and conflicting properties.
- Offers three resolution strategies:
  1. `[Smart CRDT Merge]`: Merges non-overlapping fields and chooses the latest timestamp per entity.
  2. `[Keep This Device]`: Overwrites the peer with the current device's state.
  3. `[Accept Peer]`: Adopts the remote device's state entirely.

---

## 10. Daily Standup Generator & Printable PDF Reports

### Daily Standup & Summary Generator (`DayLog.tsx`)
1-click generator compiling:
- Circadian sleep duration and quality.
- Deep focus sessions with exact timestamps and durations.
- Completed tasks grouped by project.
- Active habits completed.
- Formatted as clean GitHub-flavored Markdown with a 1-click clipboard copy button.

### One-Click PDF & Printable Digests (`Reports.tsx`)
- `Export PDF / Print` triggers high-fidelity browser print mode.
- Tailored print stylesheet (`@media print` in `src/index.css`) that strips sidebars, headers, mini-timers, ambient backdrops, and interactive controls, generating a clean, executive-ready single-page document.

---

## 11. Platform Interoperability & Mobile Android Architecture

LifeLog is packaged as a native Android APK via **Capacitor**:
- **Status Bar & Notch Insets**: Dynamic `--safe-top` and `--safe-bottom` CSS environment variables prevent notch and gesture navigation collisions.
- **Hardware Back Button Hierarchy**: Hardware back button cleanly unwinds modal stacks (Task Dialog $\rightarrow$ Sync Modal $\rightarrow$ Previous View $\rightarrow$ Exit) without unexpected app termination.
- **Reference-Counted Scroll Locking**: Prevents background body scrolling during modal interactions.
- **Tactile Haptic Feedback**: Native vibration motors triggered on task completion and timer expirations.

---

## 12. Commercial Monetization & Paid Pro Roadmap

LifeLog maintains an uncompromising free open-source core while preparing a high-value commercial upgrade path:

| Feature | Tier | Description & Value Proposition |
| :--- | :--- | :--- |
| **P2P Direct Sync** | **Free / Core** | Direct WebRTC peer-to-peer sync when both devices are open. |
| **Local Encrypted Vault** | **Free / Core** | AES-256-GCM encryption on device with password export. |
| **All 5 Layout Engines** | **Free / Core** | Glass, Control, Desk, Planify, and Zen layouts. |
| **All 12 Designer Themes** | **Free / Core** | Complete palette customization + WCAG AAA engine. |
| **2.1 Async Cloud Drop-Box** | **Paid Pro ($)** | Encrypted zero-knowledge peer drop via GitHub Gist or Cloudflare KV. Syncs devices asynchronously without both needing to be online at the same time. |
| **2.3 Local Time-Machine** | **Paid Pro ($)** | Rolling hourly cryptographic snapshot checkpoints. Instant 1-click point-in-time recovery from accidental wipes. |
| **4.3 External Calendar Sync**| **Paid Pro ($)** | Two-way iCalendar (.ics) real-time feed bridge for Google Calendar, Apple Calendar, and Microsoft Outlook. |

---

## 13. Comprehensive Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | **Open Command Palette** (Search tasks, notes, jump to views) | Global |
| `?` | **Open Keyboard Shortcuts & Help Modal** | Global |
| `N` | **Create New Task** | Global |
| `Shift + N` | **Create New Encrypted Note** | Global |
| `1` | Navigate to **Dashboard** | Global |
| `2` | Navigate to **Tasks** | Global |
| `3` | Navigate to **Focus Stage** | Global |
| `4` | Navigate to **Calendar** | Global |
| `5` | Navigate to **Habits** | Global |
| `6` | Navigate to **Day Log** | Global |
| `7` | Navigate to **Reports** | Global |
| `8` | Navigate to **Notes** | Global |
| `,` (Comma) | Open **Settings** | Global |
| `Space` | **Toggle Timer Play / Pause** | Focus View |
| `S` | **Stop Timer & Save Session** | Focus View |
| `Esc` | Close active dialog / modal / command palette | Global |

---

## 14. Author Attribution & Support

LifeLog was envisioned, designed, engineered, and fine-tuned by:

### **Krish Patel**
- **Architecture**: Local-First Sovereign Operating Systems
- **Repository**: [Krrish1411/lifelog](https://github.com/Krrish1411/lifelog)
- **Support & Patronage**: If LifeLog enhances your focus, productivity, and digital privacy, support its continued development at [**buymeacoffee.com/Krrish1411**](https://www.buymeacoffee.com/Krrish1411).

---

*LifeLog Sovereign OS — Forged for Deep Work. Built for Independence. Zero Telemetry Forever.*
