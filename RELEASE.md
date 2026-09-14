# LifeLog v1.0.0 Sovereign Edition — Initial Public Launch 🚀

> **"Your day, remembered. Your data, sovereign."**

Welcome to the official **v1.0.0 Sovereign Edition** release of **LifeLog** — an offline-first, zero-cloud personal operating system crafted with precision to unify tasks, encrypted notes, habit cadences, and deep work without subscription fatigue, tracking pixels, or cloud vendor lock-in.

---

## 🌟 What's New in v1.0.0

### 🛡️ 1. Absolute Data Sovereignty & Zero Telemetry
- **Zero Outbound Telemetry:** No analytics SDKs, no Google/Facebook tracking pixels, no telemetry cookies. The app makes **0 outbound network requests on boot**.
- **Native SQLite WAL Engine:** Desktop builds run on native `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (WAL) for sub-5ms ACID transactions and crash immunity.
- **Hardware Device-Bound Cryptography:** Private notes and sensitive database fields are sealed with authenticated AES-256-GCM encryption derived from your hardware device key.
- **Universal `.lifelog` Snapshots:** 1-click portable database exports and password-protected snapshots compatible across Desktop, Android, and Web.

---

### ⚡ 2. The 7 Core Pillars of Productivity
1. **Unified Task Agenda:** Multi-block timebox scheduling, hierarchical subtasks, recurrence engine (daily, weekly, monthly nth-weekday), and drag-to-tray unblocking.
2. **Deep Focus Studio:** Pomodoro, Countdown, and Flow stopwatch timers paired with client-side synthesized acoustic bell chimes, strict micro-pause auditing, and active task linkage.
3. **Encrypted Second Brain (Notes):** Full Markdown canvas with dynamic `@tasks`, `#projects`, and `[[notes]]` autocomplete, folder hierarchy, and AES-256 client-side encryption.
4. **Time-Grid Calendar:** Visual 24-hour day, 3-day, and week scheduling. Drag unscheduled tasks into time slots, and drag them back to the top tray anytime if plans change.
5. **Habit Cadence & Streaks:** Daily and weekly target frequencies, automatic projection into Today tasks, and 12-week GitHub-style visual heatmaps.
6. **Honest Daily Log & Circadian Sleep:** Cross-midnight sleep attribution (credits 23:00–07:00 sleep accurately without task fragmentation), energy ratings, and 1-click Markdown daily standups.
7. **Calibrated Productivity Analytics:** Estimate vs. actual task ratio calibration, hourly energy heatmaps, and lag-free executive PDF summary export.

---

### 🎨 3. 5 Adaptive Ergonomic Layout Engines
Switch seamlessly between 5 workspace engines to suit your monitor, hardware, and focus mood:
- **Liquid Glass (Modern OS):** Frosted acrylic glassmorphism with ambient light refraction and depth layering.
- **Desk Suite (Pro Station):** Classic workstation layout with a persistent desktop navigation rail.
- **Planify Clean (Minimalist):** Distraction-free split columns and focused task lists.
- **Control Center:** Compact upper command strip with telemetry footer and rapid view switches.
- **Zen Focus:** Ultra-clean canvas that hides all navigation chrome during active deep work.

---

### 🎭 4. 6 Permanently Free Core Themes + Pro Designer Beta Preview
- **6 Core Free Themes (3 Harmonized Dark & Light Pairs):**
  - **LifeLog Crimson** (Dark & Light) — Iconic crimson red highlights on deep velvet slate or crisp paper.
  - **Warm Sepia** (Night & Paper) — Gentle terracotta amber with low eye fatigue.
  - **Botanical Sage** (Forest & Garden) — Fresh herbal green designed for calm focus.
- **Pro Designer Boutique Palettes (Unlocked in Free Public Beta):**
  - **OLED Pure Black** (0% battery drain on OLED displays)
  - **Tokyo Night & Tokyo Day** (Cyberpunk twilight & editorial cobalt)
  - **Catppuccin Mocha & Catppuccin Latte** (Soothing pastel violet lavender)
  - **Nord Frost & Nord Snow Storm** (Glacial arctic teal)
  - **Dracula Midnight** (High-contrast gothic orchid)
- **Deep Customization:** Full color wheel, custom hex pickers, token engine overrides, and custom font uploads (`.ttf`, `.otf`, `.woff2`).

---

### 📡 5. Zero-Cloud P2P Device-to-Device Sync
- Direct peer-to-peer pairing between phone and laptop over local Wi-Fi and WebRTC DataChannels.
- Automatic 3-way union merge with cryptographic vector clocks and visual conflict resolver.
- **Infrastructure Covenant:** While local backups and offline sync remain 100% free forever, WebRTC signaling relays rely on community donations via [Buy Me a Coffee](https://buymeacoffee.com/Krrish1411) to offset ongoing monthly server hosting costs.

---

## 📦 Official Binaries & Packages

| Platform | Format | Package Type | Direct Download Link |
|---|---|---|---|
| **Windows** | `.exe` | 64-bit Installer | [Download LifeLog Setup (Windows)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-Setup-1.0.0.exe) |
| **Windows** | `.exe` | Portable (No Install) | [Download LifeLog Portable (Windows)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0-portable.exe) |
| **macOS** | `.dmg` | Universal (Apple Silicon & Intel) | [Download LifeLog DMG (macOS)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.dmg) |
| **Linux** | `.AppImage` | Universal Linux Executable | [Download LifeLog AppImage (Linux)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.AppImage) |
| **Android** | `.apk` | Arm64 Release APK | [Download LifeLog APK (Android)](https://github.com/Krrish1411/Lifelog-Releases/releases/download/v1.0.0/LifeLog-1.0.0.apk) |
| **Web Browser** | WebApp | Zero-Install Client PWA | [Open Sovereign Web App](https://krrish1411.github.io/Lifelog-Releases/) |

---

## 🔐 Checksum Integrity (SHA-256)

Verify downloaded binaries before execution:

```bash
# On Linux / macOS
sha256sum -c SHA256SUMS.txt

# On Windows (PowerShell)
Get-FileHash .\LifeLog-Setup-1.0.0.exe -Algorithm SHA256
```

---

## ☕ Support Independent Sovereign Software

LifeLog is 100% free, private, and open-source under the MIT license, with zero ads, zero venture capital interference, and zero recurring paywalls. If LifeLog brings peace and clarity to your daily rhythm, please consider fueling future R&D:

**[☕ Buy Me a Coffee — Support LifeLog Development](https://buymeacoffee.com/Krrish1411)**

---

*Crafted with precision by **Krish Patel**.*
