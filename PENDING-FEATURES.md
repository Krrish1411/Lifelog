# LifeLog — PENDING-FEATURES.md & COMMERCIAL ROADMAP

> **Release Status**: LifeLog v1.0 Core OS is complete, benchmarked, and verified at **10/10 Sovereignty**.  
> **Author & Lead Architect**: **Krish Patel**  
> **Patronage & Coffee**: [buymeacoffee.com/Krrish1411](https://www.buymeacoffee.com/Krrish1411)

---

## 1. Commercial / Paid Pro Features (Monetization Pipeline)

These features are architected for the upcoming commercial Pro release tier (APK & Desktop):

| Feature Code | Feature Name | Description & Monetization Model | Target Release |
| :--- | :--- | :--- | :--- |
| **Feature 2.1** | **Async Cloud Drop-Box Sync** | Encrypted zero-knowledge state drop via GitHub Gist or Cloudflare Worker KV. Devices do **not** need to be online simultaneously. State is end-to-end encrypted with the user's local passkey. **Primary monetization hook.** | Pro Tier (v1.1) |
| **Feature 2.3** | **Local Time-Machine Rollback** | Rolling hourly cryptographic snapshot checkpoints. Provides point-in-time state recovery with an interactive visual diff inspector to instantly roll back corrupted edits or unintended task wipes. | Pro Tier (v1.1) / APK Phase |
| **Feature 4.3** | **Two-Way External Calendar .ICS Sync** | Real-time iCalendar (.ics) feed publishing and subscription bridge. Projects LifeLog time-blocks and habits directly to Google Calendar, Apple Calendar, and Microsoft Outlook with bi-directional update reflection. | Pro Tier (v1.2) |

---

## 2. Deferred Experimental Features

| Feature | Reason for Deferral | Status |
| :--- | :--- | :--- |
| **WebAudio Ambient Soundscapes** | Continuous procedural ambient audio (rain, cafe, binaural waves, pink noise). Deferred per user preference to prioritize acoustic feedback over continuous white noise. | Deferred |
| **Mechanical Keyboard Typing Audio** | Synthesized mechanical keyboard click sounds on every keystroke. Explicitly excluded per user design directive. | Excluded |
| **Automatic Theme Switching** | Automatic dark/light theme switching based on system circadian time. Excluded to keep the user in complete manual control of visual theme choice. | Excluded |
| **Google Photos / Remote Media Cloud** | Remote cloud media storage. Incompatible with LifeLog's zero-cloud, local-encrypted vault ethos. | Excluded |

---

## 3. Shipped Features (Completed in v1.0 Milestone)

- [x] **Top Bar Buy Me a Coffee Patronage Button**: Persistent header integration across all 5 layout engines.
- [x] **Feature 1.1: Bi-Directional Wiki Backlinks**: `[[Note Title]]`, `#Project`, `@Task` syntax with interactive clickable chips and cross-linking trays.
- [x] **Feature 1.2: Daily Standup & Summary Generator**: 1-click Markdown digest compiling sleep, focus sessions, tasks, and habits with clipboard copy.
- [x] **Feature 1.3: Habit Projection & Interlinking**: Today's habits projected into Tasks and Calendar, with cross-completion and streak sync.
- [x] **Focus Day Streak Engine**: Main screen top-bar flame badge strictly tracks consecutive deep focus days (`calculateFocusDayStreak`), separate from habits.
- [x] **Feature 2.2: Visual 3-Way Conflict Diff Resolver**: Modal resolving local vs remote peer replicas with Smart CRDT Merge, Keep Local, and Accept Peer strategies.
- [x] **Feature 4.1: Interactive Onboarding Tour**: 5-slide visual guide to engines, 24h balance, encrypted notes, and P2P sync.
- [x] **Feature 4.2: One-Click PDF & Printable Digest**: Tailored print stylesheet (`@media print`) and export button in Reports.
- [x] **Synthetic Web Audio Feedback**: Procedural C-Major crystal arpeggio (`playHabitChime`), acoustic task pop, and timer toggle click.
- [x] **24h Balance Bar & Cross-Midnight Sleep**: Mathematical day balancing with accurate multi-day sleep splitting.
- [x] **5 Layout Engines**: Glassmorphic, Control Center, Desk Station, Planify Clean, and Zen Focus.
- [x] **12 Designer Themes**: Complete dark/light suites with WCAG AAA contrast assurance.
