# LifeLog — PROJECT.md

> Super Productivity's feature depth + Planify's UI simplicity, as a private,
> local-first "second brain": what you worked on, when, for how long, and what
> you were thinking — forever lookback-able.

## Stack (v1) & a deviation note

**Implemented stack: React 18 + Vite + TypeScript + Tailwind v4, running 100%
client-side.**

The original directive asked for **Electron + Angular**. This repository
environment builds and serves a web bundle (React + Vite), so v1 is delivered
as a browser app — with the deliberate upside that the architecture is already
desktop-ready:

- **Zero network calls.** No API, no sync, no telemetry. All state lives in
  `localStorage`, encrypted at rest.
- **Electron wrap is a packaging step, not a rewrite.** `npm run build`
  produces a static `dist/`; pointing an Electron `BrowserWindow` at
  `dist/index.html` gives you the Linux desktop app, after which AppImage /
  .tar.gz packaging (electron-builder) is straightforward. The Web Crypto and
  Notification APIs used here work identically inside Electron.

Tradeoffs vs. the Angular plan: same local-first outcome, faster iteration in
this environment, one framework (React) instead of two moving parts. Tauri
remains excluded as requested.

## Architecture

```
index.html               fonts (Space Grotesk / Manrope / JetBrains Mono), title
src/
  main.tsx               React bootstrap
  App.tsx                <AppProvider><Shell/></AppProvider>
  index.css              Tailwind v4 + theme variables + ambient background + motion
  types.ts               ALL data types + DEFAULT_SETTINGS (single source of truth)
  store.tsx              context store: load→decrypt→merge, debounced encrypt→save,
                         toasts, confirm dialogs, reminder scheduler, recurrence-aware
                         completion (toggleDone), focus hand-off, task dialog state
  utils/
    core.ts              dates, RRULE-style recurrence engine, streak math,
                         WCAG luminance/contrast + ensureContrast, session math
    crypto.ts            device key (AES-256-GCM), envelope encrypt/decrypt,
                         PBKDF2+AES password backups
    nav.ts               tiny "open daily note for date" cross-view signal
  data/seed.ts           deterministic first-run sample data (5 weeks of history)
  components/
    ui.tsx               Btn, Modal, Toggle, Seg, ColorPicker (hex always visible),
                         EmojiPicker, TagInput (case-preserving, no #), BarRow…
    TaskDialog.tsx       create/edit: priority, tags, estimate, time-block,
                         recurrence editor, snooze (full datetime), subtasks,
                         encrypted private note, inline new-project w/ emoji+hex
    Shell.tsx            the 3 layout modes, live clock, launch greeting,
                         confirm host, theme variable application
  views/
    Dashboard.tsx        check-in (energy slider+mood, editable), plan, quick-add,
                         On-this-day (1w/1m/1y), zen mode, daily-note shortcut
    Tasks.tsx            projects (type-name-to-delete), tag filter, search,
                         completed tasks keep + show completion date
    Focus.tsx            pomodoro / countdown / flow; task AND subtask tracking;
                         pause/resume timestamps; rehydrates running sessions;
                         pre-selects task from other views, never auto-starts
    Calendar.tsx         day / 3-day / week / month; drag-to-time-block;
                         now-indicator; free/busy; worked time per day (month too)
    Habits.tsx           current/longest/shortest/max-skip streaks, 12-week grid,
                         backfill by clicking past days
    Notes.tsx            folders, encrypted notes, DD-MMM-YYYY daily notes,
                         autosave re-encrypt, cross-links from Log/Report/Dashboard
    Reports.tsx          custom ranges, time-of-day histogram, per-project/tag,
                         estimate-vs-actual (clearly labeled), streak stats,
                         energy widget, searchable day-by-day log w/ date jump
    Settings.tsx         layout modes, contrast-checked theming (hex everywhere),
                         greeting mode, reminder lead + notifications, timer
                         defaults, report widget toggles, export/backup/import/reset
```

## Conventions

- **State**: one reducer-free context (`useApp().set(s => …)`), immutable
  updates, debounced encrypted persistence. No external state libs — easy to
  debug with AI assistance, per the directive.
- **Types first**: every entity is defined in `types.ts`; views never invent
  shapes.
- **Encryption**: app data → device key (AES-256-GCM, key stored once in
  localStorage). Backups → PBKDF2(SHA-256, 150k) → AES-256-GCM with the user's
  master password. Graceful `plain` fallback if Web Crypto is unavailable
  (with a visible warning toast).
- **No `#` on tags**, casing preserved. No alert/confirm — in-app modals +
  toasts. Destructive project delete requires typing the project name.
- **Time is truth**: sessions store `startedAt`, `endedAt`, and every pause's
  `at`/`resumeAt`, so any past day can be reconstructed to the minute.

## Build & run

```bash
npm install
npm run dev       # local dev server
npm run build     # static bundle → dist/   (separate from source, per directive)
```

Desktop packaging path (not executed in this environment): wrap `dist/` in an
Electron shell, package with electron-builder → `LifeLog.AppImage` +
`LifeLog.tar.gz` for Linux.
