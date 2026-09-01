# LifeLog — PROGRESS.md

## Phase checklist

- [x] **0 — Project docs**: PROJECT.md, PROGRESS.md, PENDING-FEATURES.md written
      before app code (this file).
- [x] **1 — Data model + Projects/Tasks/Subtasks/Tags**
      `types.ts`, store with encrypted persistence, TaskDialog (emoji+hex
      project creation, case-preserving tags w/o #, priority, subtasks),
      Tasks view (tag filter, search, completed tasks keep & show completion
      date, project delete requires typing the name).
- [x] **2 — Timer engine + tracking**
      Focus view: pomodoro / countdown / flow; task AND subtask level;
      every pause timestamped in the session; running sessions rehydrate
      after navigation; starting focus from dashboard/tasks pre-selects the
      task and waits for a mode choice (never auto-starts).
- [x] **3 — Calendar + scheduling + reminders**
      Day / 3-day / week / month views; drag tasks from tray to time-block;
      drag blocks to move; worked time per day incl. month cells; pulsing
      now-indicator; free/busy per day + "now" status; reminder lead time in
      settings; desktop notifications (opt-in) + in-app toasts.
- [x] **4 — Habits + recurrence engine**
      RRULE-style engine in `utils/core.ts` (every N days/weeks/months,
      weekday sets, "first/last Thursday"-style setPos); recurring tasks log
      completions and roll forward; Habits view with current / longest /
      shortest / max-skip streaks, 12-week backfillable grid.
- [x] **5 — Notes + encryption + backup/export**
      Device-key AES-256-GCM at rest; per-task encrypted private notes;
      standalone encrypted notes in folders; DD-MMM-YYYY daily notes linked
      from Dashboard, Log and Reports; plain JSON export; master-password
      encrypted `.lifelog` backups; import for all formats.
- [x] **6 — Reports & Log**
      Custom ranges + presets; time-of-day histogram; per-project & per-tag
      breakdowns; estimate-vs-actual with explicit "Planned / Tracked"
      labels and over/under delta; streak stats widget; energy widget;
      searchable day-by-day log with date-jump picker and daily-note links;
      widget visibility toggles with clean reflow.
- [x] **7 — UI/UX layout modes + theming**
      Three structural modes (Minimal rail / Dense top-bar / Modern floating
      glass) — different structure and density, not just palette; hex colour
      input everywhere; WCAG contrast auto-correction + live ratio readout;
      live clock in every layout; launch greeting with every-launch vs
      first-of-day setting.
- [x] **8 — Dashboard, greeting, polish**
      Morning/evening check-in with interactive energy slider + editable mood
      note; On-this-day flashbacks (1w/1m/1y); zen mode; ambient layered
      background; motion + micro-interactions throughout; deterministic
      5-week seed so reports/logs are alive on first launch.

## Verification notes (session log)

- **Session 1 (initial build)**: full ground-up implementation as above.
  - `npm run build` passes (static bundle in `dist/`, separate from source).
  - Type-level lint was kept clean during authoring; runtime paths to double
    -check manually in the built app: calendar drag across views, encrypted
    import with a wrong password (should show inline error, not crash),
    layout switching while a timer runs.
  - **Desktop packaging (AppImage / .tar.gz)** is intentionally not executed
    here — this environment ships a web build; the Electron wrap + packaging
    path is documented in PROJECT.md and PENDING-FEATURES.md.

- **Session 2 (dashboard rework)**: dashboard rebuilt as a proper cockpit —
  energy check-in rescaled 10→5 with labelled slider ticks, mood emoji picker
  (persisted on the day log, shown in Reports), live **Schedule** card (today's
  time blocks with a pulsing NOW marker, past-dimmed rows, free/busy chip),
  weighted **stat strip** (focused time w/ 7-day sparkline + recording badge,
  sessions today, tasks done x/y, best day streak), and an **inline encrypted
  daily note** (autosaves, "encrypting…/🔒 saved" indicator, open-in-Notes).
  Zen mode carries schedule + 5-scale check-in. `types.ts` DayLog gained
  `moodEmoji`; seed check-ins now 16 days on the 1–5 scale. Reports energy
  widget + day log rescaled to /5 with mood emoji. Build passes.

## Still open

- Electron shell + electron-builder → AppImage & .tar.gz (packaging step).
- v1.1 candidate: command palette (see PENDING-FEATURES.md).

---

## Session 2 — dashboard as a cockpit + Planify-style overhaul

- [x] **Dashboard rebuilt**: 5-point energy scale + mood emoji picker, live
      Schedule card (now-marker, free/busy), four weighted stat boxes
      (focused w/ 7-day sparkline, sessions, tasks done, day streak), inline
      encrypted daily note with save-state feedback.
- [x] **Tasks → Planify smart panel**: Inbox / Today / All tasks, then
      Projects (with hover edit buttons), Tags and Priority sections;
      project-wise grouping removed. Subtasks render as an indented **chain**
      under each task with inline add/toggle/remove.
- [x] **Search inputs**: single `SearchInput` component with guaranteed
      icon/text spacing — applied to Tasks, Focus, Notes and Reports.
- [x] **Habits**: today is one-tap; all other past days are **locked** until
      you press “Edit past days” (per-habit backfill mode). Future days
      always locked. Streak stats: current / longest / shortest / max-skip.
- [x] **Notes**: pin notes and pin folders (📌 sorted to top), proper page
      editor, full-screen **pop-out** editor, decrypt/encrypt save states.
- [x] **Reports**: energy & mood rows now show the **full note text**;
      `/5` scale + mood emoji everywhere.
- [x] **Day Log — new “super page” view**: calendar-style week strip (current
      date selected, navigate any date/week), stat boxes (minutes focused,
      sessions, tasks completed, check-in), **focus-by-project hour shapes**,
      session timeline with pause marks, completed tasks, decrypted daily
      note preview linked into Notes.
- [x] **Review — new section**: period picker (this/last week, this/last
      month), auto-insights from real data (focus, best day, completions,
      energy trend, top projects, streaks), guided reflection questions,
      saves as an encrypted note into a “Reviews” folder.
- [x] **Five interface engines** (Settings → Interface engine): Liquid Glass,
      Planify (icon rail), Desk (top bar + sidebar), Control (status bar),
      Zen (quiet column). Genuinely different structure/density each.
- [x] **Settings**: profile name (used in greeting), content **zoom
      100–200%** (content only, shell untouched) with live preview, six
      Google Font typefaces + **font file upload** (registered via FontFace,
      persisted, survives reload), Reminders & notifications section
      restructured with permission status card.
- [x] **Mini-timer widget**: floating bottom-left whenever any session runs —
      live countdown/count-up, progress bar, pause/resume/stop, jump to
      Focus. A global watchdog now also completes countdowns when you are on
      another view.
- [x] Build verified green after every phase (`npm run build`).

---

## Session 3 — productivity analytics + true blank-slate erase

- [x] **"Productivity analytics" report widget**: 8-week focus-trend bar chart
      (current week highlighted, hover for per-week minutes / completions /
      active days) plus week-over-week delta chips (▲/▼ % for focus time and
      completions) and an active-days counter. Toggleable like every widget.
- [x] **True wipe**: Settings → Danger zone now writes a `lifelog.erased.v1`
      flag before deleting the state file. On boot, the store starts from an
      **empty state (no sample data)** when the flag is present, so the app is
      a genuine blank slate. Restore = import an encrypted `.lifelog` backup
      with its master password. Confirm requires typing `DELETE`.
