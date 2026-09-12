import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  Check,
  Compass,
  Download,
  FileText,
  Flame,
  Layers,
  LayoutDashboard,
  Lock,
  Palette,
  Quote,
  Radio,
  Coffee,
  ExternalLink,
  Heart,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Calendar,
  Clock,
  Cloud,
  History,
  CheckSquare,
} from "lucide-react";
import type { LayoutMode, MobileLayoutMode, State, ThemeMode, TokenKey } from "../types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  FONT_PAIRS,
  QUOTES,
  REPORT_WIDGETS,
  SHORTCUT_ACTIONS,
  STATE_VERSION,
} from "../types";
import { ERASED_KEY, useApp } from "../store";
import {
  decryptBackup,
  decryptEnvelope,
  decryptText,
  encryptBackup,
  getDeviceKey,
} from "../utils/crypto";
import {
  contrast,
  download,
  ensureContrast,
  normalizeHex,
  todayIso,
} from "../utils/core";
import {
  CUSTOM_FONT_FAMILY,
  readFileAsDataUrl,
  saveCustomFont,
} from "../utils/fonts";
import { clearIDB, saveErasedFlag } from "../utils/idb";
import {
  Btn,
  ColorPicker,
  Labeled,
  Modal,
  Seg,
  TextArea,
  TextInput,
  Toggle,
  cn,
} from "../components/ui";
import { cleanSeedData, isSeedTask } from "../utils/cleanSeed";
import {
  playHabitChime,
  playNotificationAlarmSound,
  playTaskToggleSound,
  playTimerFinishSound,
  playTimerStartSound,
  playTimerToggleSound,
} from "../utils/audio";
import {
  checkNativeNotificationPermission,
  isLinux,
  isLinuxDesktop,
  isNative,
  isNativeMobile,
  playChimeSound,
  requestNativeNotificationPermission,
  sendNativeTestNotification,
  testNotificationAlert,
  triggerHaptic,
} from "../utils/native";

const LS_KEY = "lifelog.state.v1";

type SettingsTab = "appearance" | "focus" | "notifications" | "sync" | "general";

const TABS: { id: SettingsTab; label: string; icon: typeof Palette; desc: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, desc: "Themes, colors, engine & fonts" },
  { id: "focus", label: "Focus & Audio", icon: Volume2, desc: "Timer defaults, audio & quotes" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Alarms, block reminders & sound" },
  { id: "sync", label: "Sync & Storage", icon: Radio, desc: "P2P direct sync & encrypted vault" },
  { id: "general", label: "General", icon: SlidersHorizontal, desc: "Profile, widgets & system settings" },
];

import {
  DARK_THEMES,
  LIGHT_THEMES,
  applyThemePatch,
  getUniversalResetPatch,
  toggleThemeModePatch,
  type DesignerTheme,
} from "../utils/themes";

const ACCENT_PRESETS = [
  { name: "Crimson Red", hex: "#dc2626" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Cyan", hex: "#06b6d4" },
];

const TOKEN_ROWS: { key: TokenKey; label: string; desc: string }[] = [
  { key: "text", label: "Heading & body text", desc: "All primary text" },
  { key: "mut", label: "Secondary text", desc: "Labels, hints, timestamps" },
  { key: "panel", label: "Card background", desc: "Panels and cards" },
  { key: "panel2", label: "Raised background", desc: "Inputs, chips, hover fills" },
  { key: "line", label: "Borders & lines", desc: "Dividers everywhere" },
  { key: "ok", label: "Success green", desc: "Done states, streaks" },
  { key: "warn", label: "Warning amber", desc: "Pauses, snoozes" },
  { key: "danger", label: "Danger red", desc: "Deletes, overdue, now-line" },
];

export function SettingsView() {
  const app = useApp();
  const { state, set, toast, confirm, openSyncDialog } = app;
  const s = state.settings;

  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [importPwOpen, setImportPwOpen] = useState(false);
  const [importPw, setImportPw] = useState("");
  const [importPayload, setImportPayload] = useState<string | null>(null);
  const [importErr, setImportErr] = useState("");
  const [quotesDraft, setQuotesDraft] = useState(s.customQuotes.join("\n"));
  useEffect(() => setQuotesDraft(s.customQuotes.join("\n")), [s.customQuotes]);

  // Local draft states to prevent number inputs jumping while typing digits
  const [pomodoroDraft, setPomodoroDraft] = useState(String(s.pomodoroMin));
  const [breakDraft, setBreakDraft] = useState(String(s.breakMin));
  const [countdownDraft, setCountdownDraft] = useState(String(s.countdownMin));
  const [reminderDraft, setReminderDraft] = useState(String(s.reminderLeadMin));

  useEffect(() => { setPomodoroDraft(String(s.pomodoroMin)); }, [s.pomodoroMin]);
  useEffect(() => { setBreakDraft(String(s.breakMin)); }, [s.breakMin]);
  useEffect(() => { setCountdownDraft(String(s.countdownMin)); }, [s.countdownMin]);
  useEffect(() => { setReminderDraft(String(s.reminderLeadMin)); }, [s.reminderLeadMin]);

  const patch = (p: Partial<typeof s>) => set((st) => ({ ...st, settings: { ...st.settings, ...p } }));

  const commitPomodoro = () => {
    const val = Math.max(1, Math.min(180, parseInt(pomodoroDraft || "25", 10)));
    patch({ pomodoroMin: val });
    setPomodoroDraft(String(val));
  };
  const commitBreak = () => {
    const val = Math.max(1, Math.min(60, parseInt(breakDraft || "5", 10)));
    patch({ breakMin: val });
    setBreakDraft(String(val));
  };
  const commitCountdown = () => {
    const val = Math.max(1, Math.min(480, parseInt(countdownDraft || "45", 10)));
    patch({ countdownMin: val });
    setCountdownDraft(String(val));
  };
  const commitReminder = () => {
    const val = Math.max(0, Math.min(180, parseInt(reminderDraft || "0", 10)));
    patch({ reminderLeadMin: val });
    setReminderDraft(String(val));
  };

  const setToken = (k: TokenKey, hex: string | null) => {
    set((st) => {
      const tokens = { ...st.settings.tokens };
      if (hex === null) delete tokens[k];
      else tokens[k] = hex;
      return { ...st, settings: { ...st.settings, tokens } };
    });
  };

  const dark = s.themeMode === "dark";
  const bgNow = normalizeHex(dark ? s.bgDark : s.bgLight) ?? (dark ? "#000000" : "#ffffff");
  const tokenDefault = (k: TokenKey): string => {
    if (k === "text") return dark ? "#f3f4f6" : "#182019";
    if (k === "mut") return dark ? "#9ca3af" : "#5c6a60";
    if (k === "panel") return dark ? "#080808" : "#ffffff";
    if (k === "panel2") return dark ? "#121212" : "#f7faf7";
    if (k === "line") return dark ? "#1f1f1f" : "#d7ded8";
    if (k === "ok") return dark ? "#6fbf8e" : "#3e8f60";
    if (k === "warn") return dark ? "#e0b457" : "#a67c1f";
    return dark ? "#d66853" : "#b23c28";
  };
  const accentRatio = contrast(ensureContrast(normalizeHex(s.accent) ?? s.accent, bgNow, 4.5), bgNow).toFixed(1);

  const applyDesignerTheme = (th: DesignerTheme) => {
    const p = applyThemePatch(th);
    patch(p);
    triggerHaptic("medium");
    toast(`Applied “${th.name}” theme`, "ok");
  };

  const handleModeChange = (newMode: ThemeMode) => {
    if (newMode === s.themeMode) return;
    const p = toggleThemeModePatch(s);
    patch(p);
    triggerHaptic("light");
    toast(`Switched to ${newMode} mode`, "ok");
  };

  const handleUniversalReset = async () => {
    const ok = await confirm({
      title: "Reset All Themes & Visuals to 0?",
      body: "This will reset all theme palettes, custom hex colors, backgrounds, fonts, zoom scale, and accessibility options back to factory defaults.",
      confirmLabel: "Reset to 0",
      danger: true,
    });
    if (!ok) return;
    const resetPatch = getUniversalResetPatch();
    patch(resetPatch);
    triggerHaptic("medium");
    toast("All theme and visual customizations reset to 0", "ok");
  };

  const demoTasksCount = state.tasks ? state.tasks.filter(isSeedTask).length : 0;

  const handlePurgeDemoData = async () => {
    const ok = await confirm({
      title: "Purge Injected Demo Data?",
      body: "This will remove sample demo tasks ('Hero section redesign', 'Timer engine...', 'Atlas website'), demo habits, and demo projects that were synced from a fresh install. Your personal tasks, habits, and notes will NOT be touched.",
      confirmLabel: "Purge Demo Data",
      danger: true,
    });
    if (!ok) return;
    const { cleanedState, stats } = cleanSeedData(state);
    set(() => cleanedState);
    triggerHaptic("medium");
    toast(
      `Purged ${stats.tasksRemoved} demo tasks, ${stats.habitsRemoved} habits & ${stats.projectsRemoved} demo projects!`,
      "ok"
    );
  };

  /* ---------------- data ---------------- */
  const exportPlain = async () => {
    try {
      const key = await getDeviceKey();
      const decryptedNotes = await Promise.all(
        state.notes.map(async (n) => {
          if (!n.blob) return n;
          try {
            const body = await decryptText(key, n.blob);
            return { ...n, body };
          } catch {
            return n;
          }
        })
      );
      const decryptedTasks = await Promise.all(
        state.tasks.map(async (t) => {
          if (!t.privateNote) return t;
          try {
            const privateNotePlain = await decryptText(key, t.privateNote);
            return { ...t, privateNotePlain };
          } catch {
            return t;
          }
        })
      );
      const plainExport = {
        ...state,
        notes: decryptedNotes,
        tasks: decryptedTasks,
      };
      download(`lifelog-export-${todayIso()}.json`, JSON.stringify(plainExport, null, 2));
      toast("Plain JSON exported — readable history included", "ok");
    } catch {
      download(`lifelog-export-${todayIso()}.json`, JSON.stringify(state, null, 2));
      toast("Plain JSON exported", "ok");
    }
  };

  const makeBackup = async () => {
    if (pw1.length < 4) return toast("Master password needs at least 4 characters", "err");
    if (pw1 !== pw2) return toast("Passwords do not match", "err");
    const payload = await encryptBackup(pw1, state);
    download(`lifelog-backup-${todayIso()}.lifelog`, payload);
    setPw1(""); setPw2("");
    toast("Encrypted backup downloaded — the password is the only way back in", "ok");
  };

  const runImport = async (text: string, password: string | null): Promise<State> => {
    let data: State | null = null;
    try {
      const env = JSON.parse(text) as { kind?: string; d?: string };
      if (env?.kind === "backup") data = await decryptBackup<State>(password ?? "", text);
      else if (env?.kind === "device") data = await decryptEnvelope<State>(await getDeviceKey(), text);
      else if (env?.kind === "plain") data = JSON.parse(env.d ?? "{}") as State;
      else data = env as unknown as State;
    } catch (e) {
      throw new Error(e instanceof Error && /password/i.test(e.message) ? e.message : "Could not read that file — wrong password or not a LifeLog file");
    }
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.projects) || !Array.isArray(data.sessions)) {
      throw new Error("File has the wrong shape — not a LifeLog export");
    }
    return data;
  };

  const finishImport = async (text: string, password: string | null) => {
    try {
      const data = await runImport(text, password);
      const ok = await confirm({
        title: "Replace everything with this import?",
        body: `The file contains ${data.tasks.length} tasks, ${data.sessions.length} sessions, ${data.notes.length} notes and ${data.habits.length} habits. Your current local data will be overwritten.`,
        confirmLabel: "Import & replace", danger: true,
      });
      if (!ok) return;
      set(() => ({
        version: STATE_VERSION,
        projects: data.projects, tasks: data.tasks, habits: data.habits ?? [], folders: data.folders ?? [],
        notes: data.notes ?? [], sessions: data.sessions, dayLogs: data.dayLogs ?? {}, tagColors: data.tagColors ?? {},
        settings: {
          ...DEFAULT_SETTINGS, ...(data.settings ?? {}),
          reportWidgets: { ...DEFAULT_SETTINGS.reportWidgets, ...(data.settings?.reportWidgets ?? {}) },
          shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(data.settings?.shortcuts ?? {}) },
          tokens: data.settings?.tokens ?? {}, customQuotes: data.settings?.customQuotes ?? [],
          zenPanels: { ...DEFAULT_SETTINGS.zenPanels, ...(data.settings?.zenPanels ?? {}) },
        },
        meta: { createdAt: data.meta?.createdAt ?? Date.now(), lastGreetingDay: data.meta?.lastGreetingDay ?? null },
      }));
      toast("Import complete — history restored", "ok");
      setImportPwOpen(false); setImportPayload(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      if (password !== null) setImportErr(msg);
      else toast(msg, "err");
    }
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => {
      toast("Error reading the selected file from your device", "err");
    };
    reader.onload = async () => {
      const text = String(reader.result ?? "").trim();
      try {
        const env = JSON.parse(text) as { kind?: string };
        if (env?.kind === "backup") {
          setImportPayload(text); setImportPw(""); setImportErr(""); setImportPwOpen(true);
          return;
        }
        await finishImport(text, null);
      } catch {
        toast("Could not read that file — not valid LifeLog or JSON data", "err");
      }
    };
    reader.readAsText(f);
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: "Erase LifeLog on this device",
      body: "Every project, task, session, note and habit — including the sample data — will be completely removed, leaving a blank LifeLog. There is no undo. To restore later, import an encrypted .lifelog backup with its master password.",
      confirmLabel: "Erase everything", danger: true, requireText: "DELETE",
    });
    if (!ok) return;
    try {
      await clearIDB();
    } catch {}

    if (typeof window !== "undefined") {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {
        console.warn("Could not purge caches:", e);
      }

      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}

      await saveErasedFlag();
      window.location.reload();
    }
  };

  const [nativePerm, setNativePerm] = useState(false);
  useEffect(() => {
    checkNativeNotificationPermission().then(setNativePerm);
  }, []);

  const enableNotifs = async () => {
    const granted = await requestNativeNotificationPermission();
    setNativePerm(granted);
    if (granted) {
      patch({ notifyEnabled: true });
      toast(
        isNative
          ? "Android notifications enabled — exact alarms will fire in background & even if app is closed!"
          : "Notifications enabled — reminders will fire when due!",
        "ok"
      );
    } else {
      toast("Notification permission was denied or dismissed.", "warn");
    }
  };

  const [testingNotif, setTestingNotif] = useState(false);
  const handleTestAlert = async () => {
    setTestingNotif(true);
    triggerHaptic("medium");
    playNotificationAlarmSound();
    try {
      const ok = await testNotificationAlert();
      if (ok) {
        toast("🔔 Test alarm alert fired & chime played!", "ok");
      } else {
        toast("Notification sent (enable system permissions if banner didn't appear)", "warn");
      }
    } catch {
      toast("Notification alert sounded in-app", "ok");
    } finally {
      setTestingNotif(false);
    }
  };

  const saveQuotes = () => {
    const lines = quotesDraft.split("\n").map((q) => q.trim()).filter(Boolean);
    patch({ customQuotes: lines });
    toast(lines.length ? `${lines.length} personal line(s) saved — mixed into the greeting` : "Personal quotes cleared", "ok");
  };

  const section = (title: string, sub: string, body: React.ReactNode, span = false, className?: string) => (
    <div className={cn("card card-hover p-4 w-full min-w-0 overflow-hidden", span && "lg:col-span-2", className)}>
      <div className="font-display text-[15px] font-bold tracking-tight">{title}</div>
      <div className="mb-3 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>{sub}</div>
      {body}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight">Settings</h1>
        <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
          Personalize themes, notification alarms, focus timers and your encrypted data.
        </p>
      </div>

      {/* Top Tab Navigator */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-none">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id);
                triggerHaptic("light");
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer select-none",
                active
                  ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-sm"
                  : "bg-[var(--panel)] text-[var(--mut)] hover:text-[var(--text)] hover:bg-[var(--panel2)] border border-[var(--line)]"
              )}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="grid gap-4 lg:grid-cols-2 w-full min-w-0">
        {/* ===================== TAB 1: APPEARANCE ===================== */}
        {activeTab === "appearance" && (
          <>
            {/* Universal Theme Reset Banner */}
            <div className="card engine-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[var(--line)] bg-[var(--bg)] lg:col-span-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-display text-[14.5px] font-bold text-[var(--text)]">
                  <RotateCcw size={15} className="text-[var(--accent)]" />
                  <span>Universal Theme Reset</span>
                </div>
                <p className="text-[11.5px] font-semibold text-[var(--mut)]">
                  Revert all custom tokens, accents, wallpapers, fonts, and zoom scale back to factory 0.
                </p>
              </div>
              <Btn
                size="sm"
                variant="outline"
                onClick={handleUniversalReset}
                className="shrink-0 gap-1.5 border-[var(--line)] text-xs font-bold hover:border-[var(--danger)] hover:text-[var(--danger)] cursor-pointer"
              >
                <RotateCcw size={13} /> Reset Everything to 0
              </Btn>
            </div>

            {/* Dark Mode Themes (6 Curated Dark Palettes) */}
            {section(
              "Dark Mode Themes",
              "Curated rich night palettes with high contrast. Selecting any theme automatically activates Dark Mode.",
              (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {DARK_THEMES.map((th) => {
                    const isCurrent = s.themeMode === "dark" && s.designerTheme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => applyDesignerTheme(th)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all cursor-pointer relative",
                          isCurrent
                            ? "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent-soft)]"
                            : "border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel2)]"
                        )}
                      >
                        <div
                          className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center shadow-xs border border-white/10"
                          style={{ background: th.previewBg }}
                        >
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: th.previewAccent }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-[12px] font-bold tracking-tight truncate">
                              {th.name}
                            </span>
                            {isCurrent && (
                              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[8px] font-bold shrink-0">
                                <Check size={8} />
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] font-semibold text-[var(--accent)] truncate">
                            {th.tag}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ),
              true
            )}

            {/* Light Mode Themes (6 Curated Light Palettes) */}
            {section(
              "Light Mode Themes",
              "Clean daylight palettes with crisp legibility. Selecting any theme automatically activates Light Mode.",
              (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {LIGHT_THEMES.map((th) => {
                    const isCurrent = s.themeMode === "light" && s.designerTheme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => applyDesignerTheme(th)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all cursor-pointer relative",
                          isCurrent
                            ? "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent-soft)]"
                            : "border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel2)]"
                        )}
                      >
                        <div
                          className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center shadow-xs border border-black/10"
                          style={{ background: th.previewBg }}
                        >
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: th.previewAccent }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-[12px] font-bold tracking-tight truncate">
                              {th.name}
                            </span>
                            {isCurrent && (
                              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[8px] font-bold shrink-0">
                                <Check size={8} />
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] font-semibold text-[var(--accent)] truncate">
                            {th.tag}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ),
              true
            )}

            {/* Mode & Accent Presets */}
            {section(
              "Theme Mode & Accent Color",
              "Every generated colour is WCAG-checked against the background.",
              (
                <div className="flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Seg
                      options={[
                        { value: "dark", label: "Dark" },
                        { value: "light", label: "Light" },
                      ]}
                      value={s.themeMode}
                      onChange={(v: ThemeMode) => handleModeChange(v)}
                    />
                    <span
                      className="chip text-[10px]"
                      style={{ color: parseFloat(accentRatio) >= 4.5 ? "var(--ok)" : "var(--warn)" }}
                    >
                      <Palette size={10} /> accent contrast {accentRatio}:1
                    </span>
                  </div>

                  {/* Accent Palette Presets */}
                  <div>
                    <div className="mb-2 text-xs font-bold text-[var(--mut)] uppercase tracking-wider">
                      Accent Palette Presets
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ACCENT_PRESETS.map((p) => {
                        const active = (s.accent ?? "").toLowerCase() === p.hex.toLowerCase();
                        return (
                          <button
                            key={p.hex}
                            type="button"
                            onClick={() => {
                              patch({ accent: p.hex });
                              triggerHaptic("light");
                              toast(`Accent changed to ${p.name}`, "ok");
                            }}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all cursor-pointer",
                              active
                                ? "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "border-[var(--line)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--panel2)]"
                            )}
                          >
                            <span className="h-4 w-4 rounded-full shrink-0 shadow-xs" style={{ background: p.hex }} />
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Labeled label="Custom Accent Hex" hint="custom hex always available">
                    <div className="flex items-center gap-2">
                      <ColorPicker value={s.accent} onChange={(hex) => patch({ accent: hex })} />
                      {s.accent.toLowerCase() !== DEFAULT_SETTINGS.accent.toLowerCase() && (
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            patch({ accent: DEFAULT_SETTINGS.accent });
                            toast("Accent reset to default", "ok");
                          }}
                          title="Reset accent to default"
                        >
                          <RotateCcw size={12} /> Reset
                        </Btn>
                      )}
                    </div>
                  </Labeled>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Labeled label="Background — dark mode">
                      <div className="flex items-center gap-2">
                        <ColorPicker value={s.bgDark} onChange={(hex) => patch({ bgDark: hex })} />
                        {s.bgDark.toLowerCase() !== DEFAULT_SETTINGS.bgDark.toLowerCase() && (
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              patch({ bgDark: DEFAULT_SETTINGS.bgDark });
                              toast("Dark background reset", "ok");
                            }}
                            title="Reset dark background to default"
                          >
                            <RotateCcw size={12} /> Reset
                          </Btn>
                        )}
                      </div>
                    </Labeled>
                    <Labeled label="Background — light mode">
                      <div className="flex items-center gap-2">
                        <ColorPicker value={s.bgLight} onChange={(hex) => patch({ bgLight: hex })} />
                        {s.bgLight.toLowerCase() !== DEFAULT_SETTINGS.bgLight.toLowerCase() && (
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              patch({ bgLight: DEFAULT_SETTINGS.bgLight });
                              toast("Light background reset", "ok");
                            }}
                            title="Reset light background to default"
                          >
                            <RotateCcw size={12} /> Reset
                          </Btn>
                        )}
                      </div>
                    </Labeled>
                  </div>
                </div>
              )
            )}

            {/* Token Customizer */}
            {section(
              "Custom Theme Tokens",
              "Override any token. Contrast guards keep text readable; “Auto” returns to the generated default.",
              (
                <div className="flex flex-col gap-2">
                  {TOKEN_ROWS.map((r) => {
                    const overridden = !!s.tokens[r.key];
                    return (
                      <div
                        key={r.key}
                        className="flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2"
                        style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                      >
                        <span
                          className="h-6 w-6 shrink-0 rounded-lg border"
                          style={{
                            background: s.tokens[r.key] ?? tokenDefault(r.key),
                            borderColor: "var(--line)",
                          }}
                        />
                        <div className="w-[168px] shrink-0">
                          <div className="text-[12.5px] font-bold">{r.label}</div>
                          <div className="text-[10px] font-semibold" style={{ color: "var(--mut)" }}>
                            {r.desc}
                          </div>
                        </div>
                        <ColorPicker
                          value={s.tokens[r.key] ?? tokenDefault(r.key)}
                          onChange={(hex) => setToken(r.key, hex)}
                        />
                        {overridden && (
                          <Btn size="sm" variant="ghost" onClick={() => setToken(r.key, null)} title="Back to auto">
                            <RotateCcw size={11} /> Auto
                          </Btn>
                        )}
                      </div>
                    );
                  })}
                  <Btn
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    onClick={() => {
                      patch({
                        tokens: {},
                        accent: DEFAULT_SETTINGS.accent,
                        bgDark: DEFAULT_SETTINGS.bgDark,
                        bgLight: DEFAULT_SETTINGS.bgLight,
                      });
                      toast("All colours reset to auto", "ok");
                    }}
                  >
                    <RotateCcw size={12} /> Reset all colours
                  </Btn>
                </div>
              )
            )}

            {/* Mobile Interface Engine (Phones & Small Screens) */}
            {section(
                "Mobile Interface Engine (Phones & Small Screens)",
                "Choose your navigation and shell style on mobile devices. Classic Native is the default engine for maximum battery life and fluid ergonomics.",
                (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: "classic",
                        name: "Classic Native",
                        tag: "Default · Ergonomic & Fast",
                        desc: "Edge-to-edge grounded bottom dock with elevated action button and native header. High performance & battery-optimized.",
                        icon: Smartphone,
                      },
                      {
                        id: "liquid",
                        name: "Liquid Glass",
                        tag: "VisionOS · Floating Pill",
                        desc: "Floating pill dock with frosted multi-tier glass materials, ambient liquid illumination, and spatial Apple-style depth.",
                        icon: Sparkles,
                      },
                    ].map((eng) => {
                      const active = (s.mobileLayout ?? "classic") === eng.id;
                      const Icon = eng.icon;
                      return (
                        <button
                          key={eng.id}
                          type="button"
                          onClick={() => {
                            patch({ mobileLayout: eng.id as MobileLayoutMode });
                            triggerHaptic("medium");
                            toast(`Mobile engine switched to ${eng.name}`, "ok");
                          }}
                          className={cn(
                            "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all cursor-pointer relative",
                            active
                              ? "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent-soft)]"
                              : "border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel2)]"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                                style={{
                                  background: active ? "var(--accent)" : "var(--panel2)",
                                  color: active ? "var(--on-accent)" : "var(--text)",
                                }}
                              >
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-display text-[14px] font-bold tracking-tight truncate">
                                  {eng.name}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut)] truncate">
                                  {eng.tag}
                                </div>
                              </div>
                            </div>
                            {active && (
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-white shrink-0"
                                style={{ background: "var(--accent)" }}
                              >
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] leading-relaxed text-[var(--mut)]">
                            {eng.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ),
                true,
                "md:hidden"
              )}

            {/* Desktop Interface Engine (hidden on phones) */}
            {!isNativeMobile &&
              section(
                "Desktop Interface Engine (Screens ≥ 768px)",
                "Choose your preferred navigation shell on laptops & desktop displays.",
              (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      id: "glass",
                      name: "Liquid Glass",
                      tag: "Default · Aesthetic",
                      desc: "Floating frosted glass sidebar with dynamic ambient color glow mesh backdrop.",
                      icon: Sparkles,
                    },
                    {
                      id: "planify",
                      name: "Planify Rail",
                      tag: "Compact · Modern",
                      desc: "Ultra-clean vertical icon rail with tooltips, maximizing horizontal canvas space.",
                      icon: Layers,
                    },
                    {
                      id: "control",
                      name: "Control Bar",
                      tag: "Horizontal · Edge-to-Edge",
                      desc: "Top navigation bar with quick search, clock, and full-width view layout.",
                      icon: SlidersHorizontal,
                    },
                    {
                      id: "desk",
                      name: "Desk Suite",
                      tag: "Pro · Workstation",
                      desc: "Fixed full-height workspace sidebar with docked system status bar and timer controls.",
                      icon: LayoutDashboard,
                    },
                    {
                      id: "zen",
                      name: "Zen Cockpit",
                      tag: "Minimal · Focus",
                      desc: "Distraction-free cockpit with customizable modular panels and ambient grid.",
                      icon: Compass,
                    },
                  ].map((eng) => {
                    const active = (s.layout ?? "glass") === eng.id;
                    const Icon = eng.icon;
                    return (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => {
                          patch({ layout: eng.id as LayoutMode });
                          triggerHaptic("medium");
                          toast(`Interface engine switched to ${eng.name}`, "ok");
                        }}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all cursor-pointer relative",
                          active
                            ? "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent-soft)]"
                            : "border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel2)]"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                              style={{
                                background: active ? "var(--accent)" : "var(--panel2)",
                                color: active ? "var(--on-accent)" : "var(--text)",
                              }}
                            >
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-[14px] font-bold tracking-tight truncate">
                                {eng.name}
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut)] truncate">
                                {eng.tag}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-bold shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-[var(--mut)] mt-1">{eng.desc}</p>
                      </button>
                    );
                  })}
                  {isLinuxDesktop && (
                    <div className="col-span-full rounded-2xl border p-3.5 space-y-2 border-l-4 mt-2 bg-[var(--panel2)]" style={{ borderColor: "var(--line)", borderLeftColor: "var(--accent)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                          <span>🐧</span> Linux Desktop Rendering
                        </span>
                        <span className="text-[10.5px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          Recommended: Desk Suite
                        </span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[var(--mut)]">
                        WebKitGTK on Linux runs smoothest with <strong>Desk Suite</strong>. Liquid Glass is automatically redirected to Desk on Linux to prevent GPU compositor blank screens, but you can override this if desired.
                      </p>
                      <div className="pt-1">
                        <Toggle
                          checked={s.disableGlassOnLinux === false}
                          onChange={(checked) => patch({ disableGlassOnLinux: !checked })}
                          label="Force Liquid Glass on Linux (requires hardware accelerated compositor)"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ),
              true,
              "hidden md:block"
            )}

            {/* Typography & Scale */}
            {section(
              "Text Size & Typeface",
              "Scale applies to the whole content area — every heading, label, input and note.",
              (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="lbl mb-0">Content scale</span>
                      <span className="font-mono text-[15px] font-bold tnum" style={{ color: "var(--accent)" }}>
                        {s.uiZoom}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={200}
                      step={5}
                      value={s.uiZoom}
                      onChange={(e) => patch({ uiZoom: parseInt(e.target.value, 10) })}
                      className="energy"
                    />
                    <div className="mt-1 flex justify-between text-[10px] font-bold" style={{ color: "var(--mut)" }}>
                      <span>100% compact</span>
                      <span>200% large display</span>
                    </div>
                  </div>

                  <Labeled label="Typeface" hint="applies to headings, body and notes">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(FONT_PAIRS) as (keyof typeof FONT_PAIRS)[]).map((fp) => (
                        <button
                          key={fp}
                          onClick={() => patch({ fontPair: fp, customFontName: null })}
                          className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold transition-all"
                          style={{
                            fontFamily: `'${FONT_PAIRS[fp].family}', sans-serif`,
                            borderColor: s.fontPair === fp && !s.customFontName ? "var(--accent)" : "var(--line)",
                            color: s.fontPair === fp && !s.customFontName ? "var(--accent)" : "var(--text)",
                            background: s.fontPair === fp && !s.customFontName ? "var(--accent-soft)" : "var(--bg)",
                            cursor: "pointer",
                          }}
                        >
                          {FONT_PAIRS[fp].label.replace(" (default)", "")}
                        </button>
                      ))}
                      <label
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-[12px] font-bold transition-all hover:opacity-80"
                        style={{
                          borderColor: s.customFontName ? "var(--accent)" : "var(--line)",
                          color: s.customFontName ? "var(--accent)" : "var(--mut)",
                        }}
                      >
                        <Upload size={12} /> {s.customFontName ? `Custom: ${CUSTOM_FONT_FAMILY}` : "Upload font (.ttf/.otf/.woff2)"}
                        <input
                          type="file"
                          accept=".ttf,.otf,.woff,.woff2,font/*,application/octet-stream,*/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (!f) return;
                            try {
                              const dataUrl = await readFileAsDataUrl(f);
                              saveCustomFont(f.name, dataUrl);
                              patch({ customFontName: f.name });
                              toast(`“${CUSTOM_FONT_FAMILY}” installed from ${f.name}`, "ok");
                            } catch {
                              toast("Could not read that font file", "err");
                            }
                          }}
                        />
                      </label>
                    </div>
                  </Labeled>
                </div>
              )
            )}

            {/* Accessibility */}
            {section(
              "Accessibility",
              "Make LifeLog comfortable for everyone — motion, transparency and contrast controls.",
              (
                <div className="flex flex-col gap-3">
                  <Toggle checked={s.reduceMotion} onChange={(v) => patch({ reduceMotion: v })} label="Reduce motion" />
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    Minimizes animations and transitions throughout the app.
                  </span>

                  <Toggle checked={s.reduceTransparency} onChange={(v) => patch({ reduceTransparency: v })} label="Reduce transparency" />
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    Removes blur effects and makes panels more opaque.
                  </span>

                  <Toggle checked={s.highContrast} onChange={(v) => patch({ highContrast: v })} label="High contrast" />
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    Increases border thickness and contrast for better visibility.
                  </span>
                </div>
              )
            )}
          </>
        )}

        {/* ===================== TAB 2: FOCUS & AUDIO ===================== */}
        {activeTab === "focus" && (
          <>
            {/* Timer defaults */}
            {section(
              "Timer Presets & Defaults",
              "Used by the Focus mode — pomodoro length, break length, countdown default.",
              (
                <div className="flex flex-wrap items-end gap-4">
                  <Labeled label="Pomodoro (min)">
                    <TextInput
                      type="number"
                      min={1}
                      max={180}
                      className="w-[92px]"
                      value={pomodoroDraft}
                      onChange={(e) => setPomodoroDraft(e.target.value)}
                      onBlur={commitPomodoro}
                      onKeyDown={(e) => { if (e.key === "Enter") commitPomodoro(); }}
                    />
                  </Labeled>
                  <Labeled label="Break (min)">
                    <TextInput
                      type="number"
                      min={1}
                      max={60}
                      className="w-[92px]"
                      value={breakDraft}
                      onChange={(e) => setBreakDraft(e.target.value)}
                      onBlur={commitBreak}
                      onKeyDown={(e) => { if (e.key === "Enter") commitBreak(); }}
                    />
                  </Labeled>
                  <Labeled label="Countdown default (min)">
                    <TextInput
                      type="number"
                      min={1}
                      max={480}
                      className="w-[92px]"
                      value={countdownDraft}
                      onChange={(e) => setCountdownDraft(e.target.value)}
                      onBlur={commitCountdown}
                      onKeyDown={(e) => { if (e.key === "Enter") commitCountdown(); }}
                    />
                  </Labeled>
                </div>
              )
            )}

            {/* Audio chime soundboard */}
            {section(
              "Audio Chimes & Sound Synthesis",
              "Zero external audio files — pure 100% offline Web Audio API synthesis.",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Timer & Alarm Chimes</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                        Plays synthesized audio chimes on timer starts, completions, and schedule alarms.
                      </div>
                    </div>
                    <Toggle checked={s.soundEnabled ?? true} onChange={(v) => patch({ soundEnabled: v })} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Tactile & Habit Audio Feedback</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                        Acoustic pops on task completion, subtle clicks on pause/resume, and crystal C-major arpeggio on habit check-offs.
                      </div>
                    </div>
                    <Toggle checked={s.soundFeedback ?? true} onChange={(v) => patch({ soundFeedback: v })} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playTimerStartSound();
                        toast("Played start chime", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <Volume2 size={13} /> Start Chime
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playTimerFinishSound();
                        toast("Played finish chime", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <Volume2 size={13} /> Finish Chime
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playHabitChime();
                        toast("Played habit crystal arpeggio", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <Sparkles size={13} className="text-amber-400" /> Habit Chime
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playTaskToggleSound(true);
                        toast("Played task done pop", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <CheckSquare size={13} className="text-emerald-400" /> Task Pop
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playTimerToggleSound(false);
                        toast("Played timer toggle click", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <Clock size={13} /> Timer Click
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        playNotificationAlarmSound();
                        toast("Played notification alarm chime", "ok");
                      }}
                      className="gap-1.5 text-[11.5px]"
                    >
                      <Bell size={13} /> Alarm Chime
                    </Btn>
                  </div>
                </div>
              )
            )}

            {/* Greeting & motivation */}
            {section(
              "Greeting & Motivation Quotes",
              "Shown at launch with a quote — built-ins mixed with your own lines.",
              (
                <div className="flex flex-col gap-3">
                  <Seg
                    options={[
                      { value: "daily", label: "First launch of the day only" },
                      { value: "every", label: "Every launch" },
                    ]}
                    value={s.greeting}
                    onChange={(v) => patch({ greeting: v })}
                  />
                  <div
                    className="flex items-start gap-2.5 rounded-xl border p-3"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <Quote size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                    <span className="text-[12.5px] font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
                      {QUOTES[Math.floor(Math.random() * QUOTES.length)]}
                    </span>
                  </div>
                  <Labeled label="Your own lines (one per line)" hint="mixed randomly with built-ins">
                    <TextArea
                      className="min-h-[84px] resize-y"
                      value={quotesDraft}
                      onChange={(e) => setQuotesDraft(e.target.value)}
                      placeholder={"Show up for the hard hour.\nSmall logs, big clarity."}
                    />
                  </Labeled>
                  <Btn size="sm" variant="primary" className="self-start" onClick={saveQuotes}>
                    Save quotes
                  </Btn>
                </div>
              ),
              true
            )}
          </>
        )}

        {/* ===================== TAB 3: NOTIFICATIONS ===================== */}
        {activeTab === "notifications" && (
          <>
            {section(
              "Reminders & Exact Wakeup Alarms",
              "High-reliability alerts for scheduled tasks, calendar time blocks, and snoozed items.",
              (
                <div className="flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-end gap-3">
                    <Labeled label="Remind me … minutes before">
                      <TextInput
                        type="number"
                        min={0}
                        max={180}
                        className="w-[110px]"
                        value={reminderDraft}
                        onChange={(e) => setReminderDraft(e.target.value)}
                        onBlur={commitReminder}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitReminder();
                        }}
                      />
                    </Labeled>
                    <span
                      className="chip text-[10.5px]"
                      style={{
                        color: nativePerm ? "var(--ok)" : "var(--mut)",
                      }}
                    >
                      <Bell size={10} /> {isNative ? "Android AlarmManager" : "Browser notification permission"}:{" "}
                      {nativePerm ? "Granted" : "Not enabled"}
                    </span>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <div className="flex flex-col gap-1">
                      <Toggle
                        checked={s.notifyEnabled}
                        onChange={(v) => {
                          if (v && !nativePerm) enableNotifs();
                          else patch({ notifyEnabled: v });
                        }}
                        label="Enable Notifications & Exact Alarms"
                      />
                      <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                        {isNative
                          ? "Uses Android AlarmManager exact wakeup alarms — fires even when screen is locked or app is closed."
                          : "Dispatches desktop notifications, Service Worker background push, and audible harmonic chimes."}
                      </span>
                    </div>
                    {!s.notifyEnabled && (
                      <Btn size="sm" variant="primary" onClick={enableNotifs}>
                        <Bell size={12} /> Enable
                      </Btn>
                    )}
                  </div>

                  {/* Test notification alert button */}
                  <div className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Test Notification & Alarm System</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                        Dispatches a test notification banner, triggers device vibration, and sounds the synthesized alarm chime.
                      </div>
                    </div>
                    <Btn
                      variant="primary"
                      onClick={handleTestAlert}
                      disabled={testingNotif}
                      className="shrink-0 gap-1.5"
                    >
                      <Bell size={13} /> Test Notification & Alarm
                    </Btn>
                  </div>
                </div>
              ),
              true
            )}
          </>
        )}

        {/* ===================== TAB 4: SYNC & STORAGE ===================== */}
        {activeTab === "sync" && (
          <>
            {/* Purge Injected Demo Data Banner */}
            {demoTasksCount > 0 && (
              <div className="card engine-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 lg:col-span-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-display text-[14px] font-bold text-amber-400">
                    <AlertCircle size={15} />
                    <span>Injected Demo Data Detected ({demoTasksCount} sample tasks)</span>
                  </div>
                  <p className="text-[11.5px] font-semibold text-[var(--mut)]">
                    Sample demo tasks ("Hero section redesign", "Atlas website", sample habits) were synced from a fresh device. Purge them now to restore your clean personal records.
                  </p>
                </div>
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={handlePurgeDemoData}
                  className="shrink-0 gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <Trash2 size={13} /> Purge Demo Data
                </Btn>
              </div>
            )}

            {/* P2P Sync */}
            {section(
              "Device-to-Device Sync (P2P)",
              "End-to-end encrypted (AES-256-GCM) direct synchronization between phone and laptop without any cloud servers.",
              (
                <div className="flex flex-col gap-3">
                  <div
                    className="rounded-xl border p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--text)]">
                        <Radio size={15} className="text-emerald-500 animate-pulse" />
                        <span>Zero-Cloud Peer-to-Peer Pairing</span>
                      </div>
                      <div className="text-[11.5px] text-[var(--mut)]">
                        Pair with QR code or session ticket. Once paired, tasks, notes, habits, and focus logs sync continuously in real-time.
                      </div>
                    </div>
                    <Btn variant="primary" onClick={openSyncDialog} className="shrink-0">
                      <Radio size={13} /> Open P2P Sync Pair
                    </Btn>
                  </div>
                </div>
              ),
              true
            )}

            {/* Backups & Export */}
            {section(
              "Encrypted Vault & Backups",
              "Everything lives on this device. Exports are plain JSON; backups add a master-password layer (PBKDF2 + AES-256-GCM).",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="soft" onClick={exportPlain}>
                      <Download size={13} /> Export JSON (full history)
                    </Btn>
                    <label
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 py-[7px] text-[13px] font-bold transition-all hover:opacity-85"
                      style={{
                        background: "var(--panel2)",
                        borderColor: "var(--line)",
                        color: "var(--text)",
                      }}
                    >
                      <Upload size={13} /> Import file (.lifelog / .json)
                      <input
                        type="file"
                        accept="*/*,.json,.lifelog,application/json,text/plain,application/octet-stream"
                        className="hidden"
                        onChange={onImportFile}
                      />
                    </label>

                    <Btn
                      variant="soft"
                      onClick={() => {
                        const pasted = prompt("Paste your LifeLog backup or export JSON here:");
                        if (!pasted || !pasted.trim()) return;
                        try {
                          const env = JSON.parse(pasted.trim()) as { kind?: string };
                          if (env?.kind === "backup") {
                            setImportPayload(pasted.trim()); setImportPw(""); setImportErr(""); setImportPwOpen(true);
                            return;
                          }
                          finishImport(pasted.trim(), null);
                        } catch {
                          toast("Invalid data — must be valid LifeLog JSON", "err");
                        }
                      }}
                    >
                      <FileText size={13} /> Paste backup
                    </Btn>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                      <Lock size={12} /> Encrypted backup with master password
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className="inp w-[170px]"
                        placeholder="Master password"
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                      />
                      <input
                        type="password"
                        className="inp w-[170px]"
                        placeholder="Repeat password"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                      />
                      <Btn variant="primary" onClick={makeBackup}>
                        <Download size={13} /> Download .lifelog
                      </Btn>
                    </div>
                    <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                      Includes task creation times, every session timestamp, notes with attachments and habits — enough to fully reconstruct your history.
                    </div>
                  </div>
                </div>
              ),
              true
            )}
          </>
        )}

        {/* ===================== TAB 5: GENERAL ===================== */}
        {activeTab === "general" && (
          <>
            {/* Profile */}
            {section(
              "Profile",
              "Used in greetings across the app.",
              (
                <div className="flex items-end gap-3">
                  <Labeled label="Your name">
                    <TextInput
                      value={s.profileName}
                      onChange={(e) => patch({ profileName: e.target.value })}
                      placeholder="e.g. Krish Patel"
                    />
                  </Labeled>
                  <div
                    className="rounded-xl border px-3 py-2 text-[12.5px] font-bold"
                    style={{
                      borderColor: "var(--line)",
                      background: "var(--bg)",
                      color: "var(--accent)",
                    }}
                  >
                    “Good morning{s.profileName.trim() ? `, ${s.profileName.trim()}` : ""}”
                  </div>
                </div>
              )
            )}

            {/* Time Format */}
            {section(
              "Time Format & Clock",
              "Controls how hours, schedules, and sleep time entries are displayed.",
              (
                <div className="flex flex-col gap-2.5">
                  <Seg
                    options={[
                      { value: "12h", label: "12-Hour (e.g. 11:00 PM)" },
                      { value: "24h", label: "24-Hour (e.g. 23:00)" },
                    ]}
                    value={s.timeFormat || "12h"}
                    onChange={(val) => patch({ timeFormat: val as "12h" | "24h" })}
                  />
                  <span className="text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    Applies across the Life Log routine tracker, calendar blocks, task timestamps, and session history.
                  </span>
                </div>
              )
            )}

            {/* Tasks & Habits Workflow */}
            {section(
              "Tasks & Habits Workflow",
              "Connect daily habits with your task queue and unified agenda.",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Project Habits into Today Tasks</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                        Show today's active recurring habits in your Today task list so you can check them off directly without switching tabs.
                      </div>
                    </div>
                    <Toggle checked={s.showHabitsInTasks !== false} onChange={(v) => patch({ showHabitsInTasks: v })} />
                  </div>
                </div>
              )
            )}

            {/* Android Mobile Experience */}
            {section(
              "Mobile Architecture & Storage",
              "Mobile-optimized architecture with local-only storage and native system bars.",
              (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Native Safe Area Insets</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>Status bar and notch collision avoidance enabled</div>
                    </div>
                    <span className="chip !py-0.5 text-[11px] font-mono" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>Active</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Tactile Touch Feedback</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>Haptic feedback on task completion & reordering</div>
                    </div>
                    <span className="chip !py-0.5 text-[11px] font-mono" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>Enabled</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Local Encrypted Vault</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>AES-256 zero-server storage on device</div>
                    </div>
                    <span className="chip !py-0.5 text-[11px] font-mono" style={{ color: "var(--accent)" }}>Offline Only</span>
                  </div>
                </div>
              )
            )}

            {/* Welcome guide */}
            {section(
              "Welcome Guide & Product Tour",
              "Explore LifeLog's architecture, 7 core feature pillars, and honest day workflow anytime.",
              (
                <div className="flex flex-col gap-2.5">
                  <Btn
                    variant="soft"
                    className="self-start"
                    onClick={() => {
                      set((st) => ({ ...st, meta: { ...st.meta, hasSeenWelcome: false } }));
                      toast("Opening Welcome Guide", "ok");
                    }}
                  >
                    <Sparkles size={13} style={{ color: "var(--accent)" }} /> View Welcome & Feature Guide
                  </Btn>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                    Opens the full product introduction website with feature breakdowns and step-by-step guidance.
                  </span>
                </div>
              )
            )}

            {/* Report widgets config */}
            {section(
              "Report Widgets Visibility",
              "Choose what appears in Reports — the grid reflows automatically as you toggle.",
              (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REPORT_WIDGETS.map((rw) => (
                    <div
                      key={rw.key}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                      style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                    >
                      <div>
                        <div className="text-[12.5px] font-bold">{rw.label}</div>
                        <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                          {rw.desc}
                        </div>
                      </div>
                      <Toggle
                        checked={!!s.reportWidgets[rw.key]}
                        onChange={(v) => patch({ reportWidgets: { ...s.reportWidgets, [rw.key]: v } })}
                      />
                    </div>
                  ))}
                </div>
              ),
              true
            )}

            {/* Keyboard Shortcuts Customization */}
            {section(
              "Keyboard Shortcuts & Remapping",
              "Quick single-key navigation across the app. Press any key in the box to remap. Automatically pauses when typing in text fields.",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl glass-clear border" style={{ borderColor: "var(--line)" }}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold bg-[var(--panel2)] px-2 py-0.5 rounded-lg border border-[var(--line)]">Ctrl + K</span>
                      <span className="text-[12.5px] font-bold">Universal Command Palette</span>
                    </div>
                    <span className="text-[11px] font-medium text-[var(--mut)]">Always active</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SHORTCUT_ACTIONS.map((sa) => {
                      const currentKey = s.shortcuts?.[sa.action] ?? DEFAULT_SHORTCUTS[sa.action] ?? "";
                      return (
                        <div
                          key={sa.action}
                          className="flex items-center justify-between rounded-xl border px-3 py-2 glass-regular"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <span className="text-[12.5px] font-bold truncate pr-2">{sa.label}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="text"
                              maxLength={10}
                              value={currentKey === "space" ? "space" : currentKey.toUpperCase()}
                              onKeyDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const pressed = e.key === " " ? "space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                                patch({
                                  shortcuts: {
                                    ...s.shortcuts,
                                    [sa.action]: pressed,
                                  },
                                });
                                toast(`Remapped ${sa.label} to "${pressed}"`, "ok");
                              }}
                              onChange={() => {}}
                              title="Click and press any key to remap"
                              className="w-16 text-center font-mono text-[12px] font-bold py-1 px-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] text-[var(--accent)] cursor-pointer focus:ring-2 focus:ring-[var(--accent)]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                      Click on any shortcut box and tap a new key on your keyboard to assign.
                    </span>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        patch({ shortcuts: { ...DEFAULT_SHORTCUTS } });
                        toast("Reset all shortcuts to default", "ok");
                      }}
                    >
                      Reset to defaults
                    </Btn>
                  </div>
                </div>
              ),
              true
            )}

            {/* About LifeLog */}
            {section(
              "About LifeLog",
              "Personal, offline-first productivity system designed for daily clarity and deep work flow.",
              (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex items-center justify-between p-3.5 rounded-xl border"
                    style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  >
                    <div>
                      <div className="text-[14.5px] font-bold">LifeLog</div>
                      <div className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--mut)" }}>
                        Crafted with precision by <span className="font-extrabold text-[var(--accent)] tracking-tight">Krish Patel</span>
                      </div>
                    </div>
                    <span className="chip text-[11px] font-mono">v{STATE_VERSION}.0</span>
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--mut)" }}>
                    Zero telemetry · 100% offline-first · Local IndexedDB storage · AES-256-GCM encryption · Tailored for Android & Desktop
                  </div>
                </div>
              ),
              true
            )}

            {/* Support LifeLog / Monetization */}
            {section(
              "Support LifeLog",
              "LifeLog is 100% free, private, and open-source with zero trackers and zero ads. If LifeLog helps you stay focused and organized, consider supporting its independent development.",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href="https://buymeacoffee.com/Krrish1411"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-[20px] font-normal shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] border border-black/80"
                      style={{
                        background: "#FFDD00",
                        color: "#000000",
                        fontFamily: "'Cookie', cursive",
                        lineHeight: 1.1,
                      }}
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 8h-1V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 2.2 1.8 4 4 4h10c2.2 0 4-1.8 4-4v-2h1c1.7 0 3-1.3 3-3s-1.3-3-3-3zm-3 8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6h14v10zm3-4h-1v-2h1c.6 0 1 .4 1 1s-.4 1-1 1z" fill="#000000"/>
                        <path d="M6 9h2v4H6zm4 0h2v4h-2zm4 0h2v4h-2z" fill="#ffffff"/>
                      </svg>
                      <span>Buy me a coffee</span>
                    </a>
                    <a
                      href="https://github.com/sponsors"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[12.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        borderColor: "var(--line)",
                        background: "var(--panel)",
                        color: "var(--text)",
                      }}
                    >
                      <Heart size={14} className="text-red-500 fill-red-500" /> GitHub Sponsors
                    </a>
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--mut)" }}>
                    Pay what you want · 100% goes directly to development · $0 mandatory cost for users
                  </div>
                </div>
              ),
              true
            )}

            {/* Danger Zone */}
            {section(
              "Danger Zone",
              "Local-only means local-only: there is no cloud copy to restore from. Erasing removes everything — sample data included — and you start from a blank LifeLog. Restore by importing an encrypted .lifelog backup with its master password.",
              (
                <div className="flex flex-col gap-2">
                  <Btn variant="danger" onClick={resetAll}>
                    <Trash2 size={13} /> Erase all data — start blank
                  </Btn>
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    You will be asked to type DELETE to confirm.
                  </span>
                </div>
              ),
              true
            )}
          </>
        )}
      </div>

      <Modal
        open={importPwOpen}
        onClose={() => {
          setImportPwOpen(false);
          setImportPayload(null);
        }}
        title="Encrypted backup — enter master password"
        width={420}
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                setImportPwOpen(false);
                setImportPayload(null);
              }}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={!importPw}
              onClick={() => importPayload && finishImport(importPayload, importPw)}
            >
              <Lock size={12} /> Decrypt & import
            </Btn>
          </>
        }
      >
        <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
          This backup was sealed with a master password. It never touches any server — decryption happens right here.
        </p>
        <input
          autoFocus
          type="password"
          className="inp mt-3"
          placeholder="Master password"
          value={importPw}
          onChange={(e) => {
            setImportPw(e.target.value);
            setImportErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && importPayload && importPw && finishImport(importPayload, importPw)}
        />
        {importErr && (
          <div className="mt-2 text-[12px] font-bold" style={{ color: "var(--danger)" }}>
            {importErr}
          </div>
        )}
      </Modal>
    </div>
  );
}
