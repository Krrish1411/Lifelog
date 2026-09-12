# LifeLog Multi-Platform & P2P Sync Roadmap: Phased Implementation Plan

Comprehensive implementation roadmap and progress tracking for LifeLog across Android, Web, and Desktop (Windows, Linux, macOS).

---

## Overall Status Summary

| Phase | Description | Status | Commit / Reference |
|---|---|---|---|
| **Phase 1: Critical Bug Fixes & Code Parity** | Android check-in spacebar fix & unifying `Lifelog-Android` with `Lifelog-main` | **COMPLETED** | `73cedbc` |
| **Phase 2: Master Conversion Skill Guide** | `Webapp-2-Androidapk.md` comprehensive universal production conversion guide | **COMPLETED** | `5c9fe5f` |
| **Phase 3: Zero-Cloud P2P Sync Engine** | WebRTC DataChannels + AES-GCM-256 PBKDF2 encryption + QR / Ticket Pairing UI + Live "Always Sync" | **COMPLETED** | `96798d8` |
| **Phase 4: Desktop Architecture & Engine Setup** | Electron project scaffold + Chromium GPU engine + Windows/Linux/Mac targets | **PLANNED (ELECTRON)** | In Planning |
| **Phase 5: Desktop Native Features & UX** | System Tray with live focus countdown badge, native OS notifications, window controls | **PLANNED (ELECTRON)** | In Planning |
| **Phase 6: Multi-Platform Release Pipeline** | GitHub Actions CI/CD matrix (APK, Linux AppImage/deb, Windows msi/exe, macOS dmg) | **PLANNED** | In Planning |

---

## Detailed Breakdown by Phase

### Phase 1: Android Bug Fixes & Codebase Unification (COMPLETED)
- [x] **Daily Check-in Spacebar Issue**:
  - Root-caused in `Dashboard.tsx`: Live keystrokes had `.trim()` applied, stripping trailing whitespace and triggering a re-render cycle through `useEffect`.
  - Fix: Removed live trimming on keystroke (only trims on blur) and added an active focus ref guard.
- [x] **Universal Scroll-to-Top**:
  - Attached route change listener in `Shell.tsx` ensuring changing views resets scroll to `0,0`.
- [x] **Full Parity Synchronization**:
  - Synchronized `Lifelog-Android` and `Lifelog-main` so both contain the exact same code, dependencies, and styles.
  - Verified `npm run typecheck` and `npm run build` pass cleanly in both directories.

### Phase 2: Master Skill Guide (`Webapp-2-Androidapk.md`) (COMPLETED)
- [x] Authored a production runbook covering:
  - Notch and safe-area inset adaptation (`viewport-fit=cover`, CSS environment variables).
  - Virtual keyboard viewport stabilization (`resize="body"` vs `"none"`).
  - Touch event model, 300ms click delay elimination, overscroll containment.
  - Reference-counted body scroll lock manager (`useBodyScrollLock`).
  - Spacebar input protection rules for controlled React inputs.
  - Hardware back button hierarchical stack with priority tiers.
  - Local notification channels & exact alarms with Android `AlarmManager`.
  - Anti-theft JavaScript obfuscation with dead code injection.
  - ProGuard/R8 rules and production APK signing.
- [x] Registered as Antigravity system skill at `.agents/skills/webapp-to-android/SKILL.md`.

### Phase 3: Zero-Cloud P2P Sync Engine (COMPLETED)
- [x] **Encryption Core (`src/sync/syncCrypto.ts`)**:
  - Military-grade AES-GCM 256-bit encryption.
  - Key derivation using PBKDF2 with 100,000 iterations and SHA-256 via native `window.crypto.subtle`.
  - Cryptographically random 96-bit IVs and 128-bit salts per packet.
- [x] **Transport Core (`src/sync/syncEngine.ts`)**:
  - Direct WebRTC peer connection using Google STUN servers.
  - Reliable, ordered `RTCDataChannel` (`lifelog-sync`).
  - Base64 session tickets (Offer and Answer) for cross-network and same-Wi-Fi pairing.
  - Last-Write-Wins (LWW) CRDT state merging per entity timestamp.
- [x] **Pairing & Sync Dialog (`src/components/SyncDialog.tsx`)**:
  - Host Tab: Generates session ticket and crisp QR code using `qrcode`.
  - Join Tab: Allows pasting/scanning host ticket to generate answer ticket.
  - Connected View: Live status indicator, peer name, low-latency (<50ms) badge, force full sync button, disconnect button.
- [x] **Store & Shell Integration**:
  - Wired `syncEngine.onStateApply` to `store.tsx` for real-time remote delta merging.
  - Added P2P sync icon with live connected indicator in top navigation bar (`Shell.tsx`).
  - Added dedicated P2P Sync section in `SettingsView` (`Settings.tsx`).
  - Added desktop keyboard shortcuts (`Ctrl+K` / `Cmd+K` for command palette, `Ctrl+N` / `Cmd+N` for new task).

---

### Phase 4: Electron Desktop Architecture Setup (PLANNED)
- [ ] **Electron Scaffold**:
  - Point Electron `BrowserWindow` at `dist/index.html`.
  - Configure window dimensions (1280x800 min 900x600), custom frame/titlebar, dark background.
- [ ] **Desktop Packaging**:
  - Configure `electron-builder` for Linux (`.AppImage`, `.deb`, `.tar.gz`), Windows (`.exe`, `.msi`), and macOS (`.dmg`).

### Phase 5: Electron Desktop Native Features (PLANNED)
- [ ] **System Tray Integration**:
  - Native tray icon with context menu (Show/Hide LifeLog, Quick Add Task, Pause/Resume Focus Timer, Quit).
  - Real-time tray tooltip displaying active Pomodoro countdown.
- [ ] **Native OS Notifications**:
  - Native HTML5 Notification API supported directly out-of-the-box in Electron.
  - Background notifications when timers complete or scheduled tasks are due.
- [ ] **Desktop Global Shortcuts & Window Geometry**:
  - Register global hotkeys (`Ctrl+Shift+Space`) to summon quick-add.
  - Persist window geometry (size, position, maximized state) across launches.

### Phase 6: Multi-Platform Release Pipeline (PENDING)
- [ ] **GitHub Actions Matrix Workflow (`.github/workflows/release.yml`)**:
  - Android APK (signed release APK with ProGuard obfuscation).
  - Linux: `.AppImage` and `.deb` (built with WebKitGTK 4.x).
  - Windows: `.msi` and `.exe` installer.
  - macOS: `.dmg` (Universal binary for Intel & Apple Silicon).
- [ ] **Artifact Verification**:
  - Test binary integrity and P2P sync across simulated instances.

---

## Verification Plan

### Automated Tests & Quality Checks
- `npm run typecheck`: TypeScript zero-error verification across all modules.
- `npm run build`: Production Vite bundle validation.
- `npx cap sync android`: Capacitor Android asset synchronization.

### Manual Verification Checklist
1. **P2P Sync Pairing**: Open LifeLog on two browser tabs or device + emulator, generate offer QR on Device 1, join on Device 2, verify connection turns green.
2. **Real-Time Data Propagation**: Create a task or note on Device 1; verify it appears immediately on Device 2.
3. **Daily Check-in Spacebar**: Verify spaces can be typed freely without deletion in feeling/mood inputs.
4. **Desktop Shortcuts**: Press `Ctrl+K` to open command palette; press `Ctrl+N` to open new task dialog.

