import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { State, Task, ViewId } from "./types";
import { DEFAULT_SETTINGS, STATE_VERSION } from "./types";
import {
  decryptEnvelope,
  encryptEnvelope,
  getDeviceKey,
  hasCrypto,
} from "./utils/crypto";
import { buildSeedState } from "./data/seed";
import { loadStoredFont } from "./utils/fonts";
import { fmtClock, nextOccurrence, todayIso } from "./utils/core";
import {
  loadStateFromIDB,
  saveStateToIDB,
  loadErasuredFlag,
  saveErasedFlag,
  migrateToIDB,
} from "./utils/idb";
import {
  cancelTaskDueNotification,
  isNative,
  scheduleTaskDueNotification,
  triggerHaptic,
} from "./utils/native";
import { playNotificationAlarmSound, playTaskDoneSound } from "./utils/audio";
import { syncEngine } from "./sync/syncEngine";
import { X } from "lucide-react";
import { cn } from "./components/ui";

const LS_KEY = "lifelog.state.v1";
/** When set, a missing state file boots into a blank app instead of demo data. */
export const ERASED_KEY = "lifelog.erased.v1";

function emptyState(): State {
  return {
    version: STATE_VERSION,
    projects: [],
    tasks: [],
    habits: [],
    folders: [{ id: "f-daily", name: "Daily" }],
    notes: [],
    sessions: [],
    dayLogs: {},
    tagColors: {},
    settings: {
      ...DEFAULT_SETTINGS,
      reportWidgets: { ...DEFAULT_SETTINGS.reportWidgets },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
      tokens: {},
      customQuotes: [],
      zenPanels: { ...DEFAULT_SETTINGS.zenPanels },
    },
    meta: { createdAt: Date.now(), lastGreetingDay: null },
  };
}

/* ------------------------------------------------------------------ */
export interface ToastItem {
  id: number;
  msg: string;
  kind: "ok" | "warn" | "err";
}
export interface ConfirmOpts {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
}
export interface TaskDialogState {
  open: boolean;
  taskId: string | null;
  projectId?: string;
  presetDate?: string | null;
  presetTime?: string | null;
}

interface AppCtx {
  state: State;
  set: (fn: (s: State) => State) => void;
  toast: (msg: string, kind?: ToastItem["kind"]) => void;
  view: ViewId;
  setView: (v: ViewId) => void;
  focusTaskId: string | null;
  requestFocus: (taskId?: string | null) => void;
  clearFocusRequest: () => void;
  taskDialog: TaskDialogState;
  openTaskDialog: (o?: Partial<TaskDialogState>) => void;
  closeTaskDialog: () => void;
  syncDialogOpen: boolean;
  openSyncDialog: () => void;
  closeSyncDialog: () => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  confirmReq: (ConfirmOpts & { open: boolean }) | null;
  resolveConfirm: (v: boolean) => void;
  toggleDone: (taskId: string) => void;
}


const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

/* ---------------- state loading / merging ---------------- */
function mergeState(raw: Partial<State>): State {
  const base = raw as State;
  return {
    version: STATE_VERSION,
    projects: base.projects ?? [],
    tasks: base.tasks ?? [],
    habits: base.habits ?? [],
    folders: base.folders ?? [],
    notes: base.notes ?? [],
    sessions: base.sessions ?? [],
    dayLogs: base.dayLogs ?? {},
    tagColors: base.tagColors ?? {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...(base.settings ?? {}),
      reportWidgets: {
        ...DEFAULT_SETTINGS.reportWidgets,
        ...(base.settings?.reportWidgets ?? {}),
      },
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...(base.settings?.shortcuts ?? {}),
      },
      tokens: base.settings?.tokens ?? {},
      customQuotes: base.settings?.customQuotes ?? [],
      zenPanels: {
        ...DEFAULT_SETTINGS.zenPanels,
        ...(base.settings?.zenPanels ?? {}),
      },
    },
    meta: {
      createdAt: base.meta?.createdAt ?? Date.now(),
      lastGreetingDay: base.meta?.lastGreetingDay ?? null,
      hasSeenWelcome: base.meta?.hasSeenWelcome ?? false,
      hasCompletedNamePrompt: base.meta?.hasCompletedNamePrompt ?? false,
    },
  };
}

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [view, setView] = useState<ViewId>("dashboard");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>({ open: false, taskId: null });
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const openSyncDialog = useCallback(() => setSyncDialogOpen(true), []);
  const closeSyncDialog = useCallback(() => setSyncDialogOpen(false), []);
  const [confirmReq, setConfirmReq] = useState<(ConfirmOpts & { open: boolean }) | null>(null);
  const confirmResolve = useRef<((v: boolean) => void) | null>(null);
  const warnedCrypto = useRef(false);

  const isRemoteSyncRef = useRef(false);
  const firedRemindersRef = useRef<Set<string>>(new Set());

  /* ----- sync engine listener for incoming remote changes ----- */
  useEffect(() => {
    return syncEngine.onStateApply((updater) => {
      isRemoteSyncRef.current = true;
      setState((prev) => (prev ? updater(prev) : prev));
    });
  }, []);

  /* ----- register local state getter for sync engine ----- */
  useEffect(() => {
    syncEngine.registerLocalStateGetter(() => state);
  }, [state]);

  /* ----- boot: decrypt at-rest state, or seed on first run ----- */
  useEffect(() => {
    loadStoredFont();
    let cancelled = false;
    (async () => {
      const key = await getDeviceKey();
      let next: State | null = null;
      
      // Try migrating from localStorage to IndexedDB (one-time)
      try {
        await migrateToIDB();
      } catch {
        // Migration failed, continue with normal loading
      }
      
      // First try IndexedDB
      try {
        const idbState = await loadStateFromIDB();
        if (idbState) next = mergeState(idbState);
      } catch {
        next = null;
      }
      
      // Fallback to localStorage if IDB failed
      if (!next) {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) next = mergeState(await decryptEnvelope<State>(key, raw));
        } catch {
          next = null;
        }
      }
      
      if (!next) {
        const erased = await loadErasuredFlag();
        next = erased ? emptyState() : mergeState(await buildSeedState());
      }
      
      if (!cancelled) {
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- persist (debounced, encrypted) ----- */
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(async () => {
      try {
        // Try IndexedDB first, fallback to localStorage
        await saveStateToIDB(state);
      } catch {
        // IDB failed, use localStorage as fallback
        try {
          const key = await getDeviceKey();
          localStorage.setItem(LS_KEY, await encryptEnvelope(key, state));
        } catch {
          /* storage full / private mode — keep working in memory */
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  /* ----- live broadcast to connected peer ("Always Sync") ----- */
  useEffect(() => {
    if (!state) return;
    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }
    if (syncEngine.getStatus() === "connected") {
      const t = setTimeout(() => {
        syncEngine.broadcastFullState(state).catch(console.error);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [state]);

  const set = useCallback((fn: (s: State) => State) => setState((s) => (s ? fn(s) : s)), []);

  const pushToast = useCallback((msg: string, kind: ToastItem["kind"] = "ok") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
  }, []);
  const toast = pushToast;

  /* ----- confirmation dialog (promise based) ----- */
  const confirm = useCallback((o: ConfirmOpts) => {
    setConfirmReq({ ...o, open: true });
    return new Promise<boolean>((res) => {
      confirmResolve.current = res;
    });
  }, []);
  const resolveConfirm = useCallback((v: boolean) => {
    confirmResolve.current?.(v);
    confirmResolve.current = null;
    setConfirmReq(null);
  }, []);

  /* ----- focus hand-off (never auto-starts) ----- */
  const requestFocus = useCallback((taskId?: string | null) => {
    setFocusTaskId(taskId ?? null);
    setView("focus");
  }, []);
  const clearFocusRequest = useCallback(() => setFocusTaskId(null), []);

  const openTaskDialog = useCallback((o?: Partial<TaskDialogState>) => {
    setTaskDialog({
      open: true,
      taskId: o?.taskId ?? null,
      projectId: o?.projectId,
      presetDate: o?.presetDate ?? null,
    });
  }, []);
  const closeTaskDialog = useCallback(() => setTaskDialog((d) => ({ ...d, open: false })), []);

  /* ----- recurring-aware task completion ----- */
  const toggleDone = useCallback(
    (taskId: string) => {
      setState((s) => {
        if (!s) return s;
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task) return s;
        if (task.recurrence) {
          if (task.done) return s; // recurring tasks are never "permanently" done
          const anchor = task.due ?? todayIso();
          const nextDue = nextOccurrence(anchor, task.recurrence);
          if (isNative) cancelTaskDueNotification(taskId);
          pushToast(`Done — next occurrence ${nextDue}`, "ok");
          return {
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === taskId
                ? { ...t, completions: [...t.completions, { at: Date.now() }], due: nextDue, dueTime: null }
                : t,
            ),
          };
        }
        const nowDone = !task.done;
        if (nowDone) {
          playTaskDoneSound();
          if (isNative) {
            cancelTaskDueNotification(taskId);
            if (task.timeBlocks) {
              for (const b of task.timeBlocks) {
                cancelTaskDueNotification(`${taskId}-${b.id}`);
              }
            }
          }
        }
        triggerHaptic(nowDone ? "success" : "light");
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, done: nowDone, doneAt: nowDone ? Date.now() : null } : t,
          ),
        };
      });
    },
    [pushToast],
  );

  /* ----- reminder scheduler (blocks + multi-blocks + snoozes + Android AlarmManager exact alarms) ----- */
  useEffect(() => {
    if (!state) return;
    const timers: number[] = [];
    const leadMin = state.settings.reminderLeadMin;
    const lead = leadMin * 60000;

    const notify = (title: string, body: string) => {
      pushToast(`${title} — ${body}`, "warn");
      triggerHaptic("warning");
      if (state.settings.soundEnabled) {
        playNotificationAlarmSound();
      }
      const hasPerm = typeof Notification !== "undefined" && Notification.permission === "granted";
      if (hasPerm) {
        try {
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready
              .then((reg) => {
                reg.showNotification(title, {
                  body,
                  icon: "/icon-192.png",
                  badge: "/icon-192.png",
                  vibrate: [250, 100, 250],
                  tag: `lifelog-${Date.now()}`,
                } as NotificationOptions);
              })
              .catch(() => {
                new Notification(title, { body, icon: "/icon-192.png" });
              });
          } else {
            new Notification(title, { body, icon: "/icon-192.png" });
          }
        } catch {
          /* ignore */
        }
      }
    };

    const checkReminders = () => {
      const now = Date.now();
      for (const t of state.tasks) {
        if (t.done) {
          if (isNative) {
            cancelTaskDueNotification(t.id);
            if (t.timeBlocks) {
              for (const b of t.timeBlocks) {
                cancelTaskDueNotification(`${t.id}-${b.id}`);
              }
            }
          }
          continue;
        }

        // Schedule background exact alarm via Android AlarmManager (fires even when app is killed)
        if (state.settings.notifyEnabled && isNative && t.due && t.dueTime) {
          scheduleTaskDueNotification(t, leadMin);
        }

        const targets: { key: string; at: number; what: string }[] = [];
        if (t.due && t.dueTime) {
          targets.push({
            key: `task-due-${t.due}-${t.dueTime}`,
            at: new Date(`${t.due}T${t.dueTime}:00`).getTime(),
            what: leadMin > 0 ? `Upcoming: ${t.title}` : `Time block starting: ${t.title}`,
          });
        }
        // Support all multi-block calendar schedules
        if (t.timeBlocks && t.timeBlocks.length > 0) {
          for (const b of t.timeBlocks) {
            if (!b.done && b.date && b.time) {
              targets.push({
                key: `block-${b.id}-${b.date}-${b.time}`,
                at: new Date(`${b.date}T${b.time}:00`).getTime(),
                what: `Time block starting (${b.label || "Scheduled"})`,
              });
              if (state.settings.notifyEnabled && isNative) {
                scheduleTaskDueNotification(
                  { id: `${t.id}-${b.id}`, title: `${t.title} [${b.label || "Block"}]`, due: b.date, dueTime: b.time },
                  leadMin,
                );
              }
            }
          }
        }
        if (t.snoozedUntil) {
          targets.push({
            key: `snooze-${t.snoozedUntil}`,
            at: t.snoozedUntil,
            what: "Snoozed task is back",
          });
        }

        for (const tg of targets) {
          const fire = tg.at - lead;
          const reminderId = `${t.id}-${tg.key}-${fire}`;

          // Catch-up: if it fell due within the last 60 seconds and hasn't fired yet
          if (fire <= now && now - fire < 60000) {
            if (!firedRemindersRef.current.has(reminderId)) {
              firedRemindersRef.current.add(reminderId);
              notify(tg.what, `${t.title} · ${fmtClock(tg.at)}`);
            }
          } else if (fire > now && fire < now + 24 * 3600000) {
            timers.push(
              window.setTimeout(() => {
                if (!firedRemindersRef.current.has(reminderId)) {
                  firedRemindersRef.current.add(reminderId);
                  notify(tg.what, `${t.title} · ${fmtClock(tg.at)}`);
                }
              }, fire - now),
            );
          }
        }
      }
    };

    checkReminders();
    const interval = window.setInterval(checkReminders, 25000);
    const onVis = () => {
      if (document.visibilityState === "visible") checkReminders();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, pushToast]);

  /* ----- toast host auto-dismiss ----- */
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((ts) => ts.slice(1)), 3400);
    return () => clearTimeout(t);
  }, [toasts]);

  const dismissToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<AppCtx | null>(
    () =>
      state
        ? {
            state,
            set,
            toast,
            view,
            setView,
            focusTaskId,
            requestFocus,
            clearFocusRequest,
            taskDialog,
            openTaskDialog,
            closeTaskDialog,
            syncDialogOpen,
            openSyncDialog,
            closeSyncDialog,
            confirm,
            confirmReq,
            resolveConfirm,
            toggleDone,
          }
        : null,
    [state, set, toast, view, focusTaskId, taskDialog, syncDialogOpen, confirmReq, requestFocus, clearFocusRequest, openTaskDialog, closeTaskDialog, openSyncDialog, closeSyncDialog, confirm, resolveConfirm, toggleDone],
  );

  if (!value) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5" style={{ background: "var(--bg)" }}>
        <div className="relative h-16 w-16">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(var(--accent) 0deg 250deg, transparent 250deg)",
              WebkitMask: "radial-gradient(farthest-side, transparent 62%, black 64%)",
              mask: "radial-gradient(farthest-side, transparent 62%, black 64%)",
              animation: "spin 1.1s linear infinite",
            }}
          />
        </div>
        <div className="text-center">
          <div className="font-display text-xl font-700 font-bold tracking-tight">LifeLog</div>
          <div className="mt-1 text-[12.5px]" style={{ color: "var(--mut)" }}>
            Decrypting your local log…
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* toast host: swipeable on Android and touch screens */}
      <div
        className="pointer-events-none fixed z-[110] left-3.5 right-3.5 sm:left-auto sm:right-5 sm:w-[350px] flex flex-col gap-2"
        style={{
          bottom: "calc(78px + var(--safe-bottom, 12px))",
        }}
      >
        {toasts.map((t) => (
          <SwipeableToast key={t.id} item={t} onDismiss={dismissToast} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function SwipeableToast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    setOffsetX(diff);
  };

  const handleTouchEnd = () => {
    if (!swiping) return;
    setSwiping(false);
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 55) {
      setDismissing(true);
      setOffsetX(diff > 0 ? 380 : -380);
      triggerHaptic("light");
      setTimeout(() => onDismiss(item.id), 160);
    } else {
      setOffsetX(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    isDraggingRef.current = true;
    setSwiping(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    currentXRef.current = e.clientX;
    setOffsetX(currentXRef.current - startXRef.current);
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setSwiping(false);
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 55) {
      setDismissing(true);
      setOffsetX(diff > 0 ? 380 : -380);
      triggerHaptic("light");
      setTimeout(() => onDismiss(item.id), 160);
    } else {
      setOffsetX(0);
    }
  };

  const opacity = Math.max(0, 1 - Math.abs(offsetX) / 200);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        "pop pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-[13px] font-semibold shadow-2xl backdrop-blur-xl select-none cursor-grab active:cursor-grabbing",
        !swiping && "transition-all duration-200 ease-out"
      )}
      style={{
        transform: `translateX(${offsetX}px)`,
        opacity: dismissing ? 0 : opacity,
        background: "color-mix(in srgb, var(--panel2) 96%, var(--bg))",
        borderColor:
          item.kind === "err"
            ? "var(--danger)"
            : item.kind === "warn"
            ? "var(--warn)"
            : "color-mix(in srgb, var(--accent) 50%, var(--line))",
        color: "var(--text)",
        touchAction: "pan-y",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className="h-2 w-2 shrink-0 rounded-full shadow-xs"
          style={{
            background:
              item.kind === "err"
                ? "var(--danger)"
                : item.kind === "warn"
                ? "var(--warn)"
                : "var(--ok)",
          }}
        />
        <span className="leading-snug break-words">{item.msg}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDismissing(true);
          setOffsetX(300);
          triggerHaptic("light");
          setTimeout(() => onDismiss(item.id), 140);
        }}
        className="p-1 -mr-1 rounded-lg text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition-colors shrink-0 cursor-pointer"
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ---------------- shared selectors ---------------- */
export function taskById(s: State, id: string | null): Task | undefined {
  return s.tasks.find((t) => t.id === id);
}
export function projectColor(s: State, projectId: string): string {
  return s.projects.find((p) => p.id === projectId)?.color ?? "var(--accent)";
}
