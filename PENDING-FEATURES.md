# LifeLog — PENDING-FEATURES.md

Explicitly **deferred** from v1 by the build directive. Do not build these into
v1; revisit in the order suggested below.

## Deferred (out of scope for v1)

| Feature | Notes |
| --- | --- |
| Cloud sync / Google Calendar sync | v1 is strictly offline; nothing leaves the device. Sync needs a conflict-resolution design first (sessions are append-only, which helps). |
| Android / mobile app | Desktop-first. The responsive layout modes are a head-start, but touch ergonomics need their own pass. |
| Plugin system | Stabilise the internal data model (`types.ts`) first; a plugin API would version `State`. |
| Dedicated "deep work" session mode | Zen mode on the dashboard covers part of this; a full kiosk-style deep-work flow is separate. |
| Google Photos integration / rich media previews in notes | Notes are encrypted plain-text by design; media needs an encrypted-attachment format. |
| Obsidian-style bi-directional note linking | Requires a link graph + rename propagation; deferred until note volume justifies it. |
| Automated energy-based timeline blocking | **Manual** time-blocking (drag-to-calendar) is in v1; the *automation* that proposes blocks from energy history is not. |

## Candidates for v1.1

- ~~Guided weekly/monthly review flow~~ — **shipped** as the Review section
  (period insights + reflection, saved as encrypted notes).
- **Command palette / natural-language quick-add** — `Ctrl+K` launcher;
  quick-add already exists on the dashboard in plain form.

## Known v1 follow-ups (small)

- Electron shell + electron-builder config → **AppImage** and **.tar.gz**
  Linux packages (build output kept in a separate folder from source).
- Reminder scheduling currently re-arms on state changes while the app is
  open; a background worker would extend this to closed-app reminders
  (Electron only).
- iCal (.ics) export of time-blocks as an offline-friendly calendar bridge.
