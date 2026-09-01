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
  const [confirmReq, setConfirmReq] = useState<(ConfirmOpts & { open: boolean }) | null>(null);
  const confirmResolve = useRef<((v: boolean) => void) | null>(null);
  const warnedCrypto = useRef(false);

  /* ----- boot: decrypt at-rest state, or seed on first run ----- */
  useEffect(() => {
    loadStoredFont();
    let cancelled = false;
    (async () => {
      const key = await getDeviceKey();
      let next: State | null = null;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) next = mergeState(await decryptEnvelope<State>(key, raw));
      } catch {
        next = null;
      }
      if (!next) next = localStorage.getItem(ERASED_KEY) ? emptyState() : mergeState(await buildSeedState());
      if (!cancelled) {
        if (!hasCrypto && !warnedCrypto.current) {
          warnedCrypto.current = true;
          pushToast("Web Crypto unavailable — data stored unencrypted in this browser", "warn");
        }
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
        const key = await getDeviceKey();
        localStorage.setItem(LS_KEY, await encryptEnvelope(key, state));
      } catch {
        /* storage full / private mode — keep working in memory */
      }
    }, 400);
    return () => clearTimeout(t);
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

  /* ----- reminder scheduler (blocks + snoozes) ----- */
  useEffect(() => {
    if (!state) return;
    const timers: number[] = [];
    const now = Date.now();
    const lead = state.settings.reminderLeadMin * 60000;
    const notify = (title: string, body: string) => {
      pushToast(`${title} — ${body}`, "warn");
      if (
        state.settings.notifyEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body });
        } catch {
          /* ignore */
        }
      }
    };
    for (const t of state.tasks) {
      if (t.done) continue;
      const targets: { at: number; what: string }[] = [];
      if (t.due && t.dueTime) {
        targets.push({ at: new Date(`${t.due}T${t.dueTime}:00`).getTime(), what: "Time block starting" });
      }
      if (t.snoozedUntil) targets.push({ at: t.snoozedUntil, what: "Snoozed task is back" });
      for (const tg of targets) {
        const fire = tg.at - lead;
        if (fire > now && fire < now + 24 * 3600000) {
          timers.push(
            window.setTimeout(
              () => notify(tg.what, `${t.title} · ${fmtClock(tg.at)}`),
              fire - now,
            ),
          );
        }
      }
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [state, pushToast]);

  /* ----- toast host auto-dismiss ----- */
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((ts) => ts.slice(1)), 3400);
    return () => clearTimeout(t);
  }, [toasts]);

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
            confirm,
            confirmReq,
            resolveConfirm,
            toggleDone,
          }
        : null,
    [state, set, toast, view, focusTaskId, taskDialog, confirmReq, requestFocus, clearFocusRequest, openTaskDialog, closeTaskDialog, confirm, resolveConfirm, toggleDone],
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
      {/* toast host */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pop pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold shadow-xl"
            style={{
              background: "var(--panel2)",
              borderColor: t.kind === "err" ? "var(--danger)" : t.kind === "warn" ? "var(--warn)" : "var(--line)",
              color: "var(--text)",
            }}
          >
            <span
              className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full"
              style={{
                background: t.kind === "err" ? "var(--danger)" : t.kind === "warn" ? "var(--warn)" : "var(--ok)",
              }}
            />
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/* ---------------- shared selectors ---------------- */
export function taskById(s: State, id: string | null): Task | undefined {
  return s.tasks.find((t) => t.id === id);
}
export function projectColor(s: State, projectId: string): string {
  return s.projects.find((p) => p.id === projectId)?.color ?? "var(--accent)";
}
