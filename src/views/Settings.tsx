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
  CheckCircle2,
  Mail,
  RefreshCw,
} from "lucide-react";
import type { LayoutMode, MobileLayoutMode, State, ThemeMode, TokenKey, AppVersionInfo } from "../types";
import {
  APP_VERSION,
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
  exportVaultBackup,
  importVaultBackupFromFile,
  setVaultMasterPassword,
  getVaultAuthInfo,
} from "../db/database";
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
  isBrowser,
  isElectron,
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

  const [showUnencryptedWarningModal, setShowUnencryptedWarningModal] = useState(false);
  const [exportPwOpen, setExportPwOpen] = useState(false);
  const [exportPw1, setExportPw1] = useState("");
  const [exportPw2, setExportPw2] = useState("");
  const [exportPwErr, setExportPwErr] = useState("");
  const [importPwOpen, setImportPwOpen] = useState(false);
  const [importPw, setImportPw] = useState("");
  const [importPayload, setImportPayload] = useState<string | null>(null);
  const [importErr, setImportErr] = useState("");

  // Update checker state
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    status: "idle" | "latest" | "available" | "error";
    data?: AppVersionInfo;
    errorMsg?: string;
  }>({ status: "idle" });
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const isNewerVersion = (remote: string, current: string): boolean => {
    const rParts = remote.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const cParts = current.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] ?? 0;
      const c = cParts[i] ?? 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  };

  const checkForUpdates = async () => {
    setUpdateChecking(true);
    setUpdateResult({ status: "idle" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch("https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json", {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AppVersionInfo = await res.json();

      if (isNewerVersion(data.version, APP_VERSION)) {
        setUpdateResult({ status: "available", data });
        setShowUpdateModal(true);
      } else {
        setUpdateResult({ status: "latest", data });
        toast(`LifeLog is up to date (v${APP_VERSION})`, "ok");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setUpdateResult({
        status: "error",
        errorMsg: err.name === "AbortError"
          ? "Update check timed out. You may be offline or the connection was slow."
          : "Could not reach the releases server. Verify your connection.",
      });
    } finally {
      setUpdateChecking(false);
    }
  };

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
    if (th.isPro) {
      toast(`Applied “${th.name}” (Pro Theme · Free Beta Preview)`, "ok");
    } else {
      toast(`Applied “${th.name}” (Core Free Theme)`, "ok");
    }
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

  /* ---------------- data & backup exports ---------------- */
  const handleExportLifelogSnapshot = async () => {
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
      const snapshot = {
        lifelog_format: "portable_snapshot",
        version: 1,
        exportedAt: Date.now(),
        encryption: "none",
        warning: "UNENCRYPTED PORTABLE SNAPSHOT — For temporary migration or trusted offline drives only. Delete after use.",
        data: {
          ...state,
          notes: decryptedNotes,
          tasks: decryptedTasks,
        },
      };
      download(`lifelog_snapshot_${todayIso()}.lifelog`, JSON.stringify(snapshot, null, 2));
      setShowUnencryptedWarningModal(true);
    } catch (e) {
      toast("Export error: " + String(e), "err");
    }
  };

  const handleExportPasswordProtected = async () => {
    if (exportPw1.length < 4) {
      setExportPwErr("Password must be at least 4 characters");
      return;
    }
    if (exportPw1 !== exportPw2) {
      setExportPwErr("Passwords do not match");
      return;
    }
    try {
      const payload = await encryptBackup(exportPw1, state);
      download(`lifelog_protected_backup_${todayIso()}.lifelog`, payload);
      setExportPwOpen(false);
      setExportPw1("");
      setExportPw2("");
      setExportPwErr("");
      toast("Password-protected backup downloaded! Safe to store in cloud or email.", "ok");
    } catch (err) {
      setExportPwErr("Encryption failed: " + String(err));
    }
  };

  const exportPlain = async () => {
    try {
      download(`lifelog-export-${todayIso()}.json`, JSON.stringify(state, null, 2));
      toast("Plain JSON history exported", "ok");
    } catch (e) {
      toast("Export failed: " + String(e), "err");
    }
  };

  const runImport = async (text: string, password: string | null): Promise<State> => {
    let data: State | null = null;
    try {
      const env = JSON.parse(text) as {
        kind?: string;
        lifelog_format?: string;
        data?: State;
        d?: string;
      };
      if (env?.kind === "backup") {
        data = await decryptBackup<State>(password ?? "", text);
      } else if (env?.lifelog_format === "portable_snapshot" && env.data) {
        data = env.data;
      } else if (env?.kind === "device") {
        data = await decryptEnvelope<State>(await getDeviceKey(), text);
      } else if (env?.kind === "plain") {
        data = JSON.parse(env.d ?? "{}") as State;
      } else {
        data = env as unknown as State;
      }
    } catch (e) {
      throw new Error(
        e instanceof Error && /password/i.test(e.message)
          ? e.message
          : "Could not read that file — wrong password or not a LifeLog file"
      );
    }
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.projects) || !Array.isArray(data.sessions)) {
      throw new Error("File has the wrong shape — not a valid LifeLog export");
    }
    return data;
  };

  const finishImport = async (text: string, password: string | null) => {
    try {
      const data = await runImport(text, password);
      const ok = await confirm({
        title: "Restore backup and replace current data?",
        body: `The file contains ${data.tasks.length} tasks, ${data.sessions.length} sessions, ${data.notes.length} notes, and ${data.habits.length} habits. Your current local data will be replaced and re-encrypted with this device's key.`,
        confirmLabel: "Import & replace",
        danger: true,
      });
      if (!ok) return;
      set(() => ({
        version: STATE_VERSION,
        projects: data.projects,
        tasks: data.tasks,
        habits: data.habits ?? [],
        folders: data.folders ?? [],
        notes: data.notes ?? [],
        sessions: data.sessions,
        dayLogs: data.dayLogs ?? {},
        tagColors: data.tagColors ?? {},
        settings: {
          ...DEFAULT_SETTINGS,
          ...(data.settings ?? {}),
          reportWidgets: { ...DEFAULT_SETTINGS.reportWidgets, ...(data.settings?.reportWidgets ?? {}) },
          shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(data.settings?.shortcuts ?? {}) },
          tokens: data.settings?.tokens ?? {},
          customQuotes: data.settings?.customQuotes ?? [],
          zenPanels: { ...DEFAULT_SETTINGS.zenPanels, ...(data.settings?.zenPanels ?? {}) },
        },
        meta: { createdAt: data.meta?.createdAt ?? Date.now(), lastGreetingDay: data.meta?.lastGreetingDay ?? null },
      }));
      toast("Import complete — vault successfully restored!", "ok");
      setImportPwOpen(false);
      setImportPayload(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      if (password !== null) setImportErr(msg);
      else toast(msg, "err");
    }
  };

  const handleImportSqlite = async (f: File) => {
    try {
      const res = await importVaultBackupFromFile(f);
      if (res.success) {
        toast("SQLite database restored successfully! Reloading...", "ok");
        setTimeout(() => window.location.reload(), 600);
      } else if (res.error && res.error !== "Cancelled") {
        toast("SQLite import error: " + res.error, "err");
      }
    } catch (err) {
      toast("SQLite import failed: " + String(err), "err");
    }
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.name.endsWith(".sqlite3") || f.name.endsWith(".db")) {
      handleImportSqlite(f);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast("Error reading the selected file from your device", "err");
    };
    reader.onload = async () => {
      const text = String(reader.result ?? "").trim();
      try {
        const env = JSON.parse(text) as { kind?: string; lifelog_format?: string };
        if (env?.kind === "backup") {
          setImportPayload(text);
          setImportPw("");
          setImportErr("");
          setImportPwOpen(true);
          return;
        }
        await finishImport(text, null);
      } catch {
        if (text.startsWith("SQLite format 3")) {
          handleImportSqlite(f);
          return;
        }
        toast("Could not read that file — not valid LifeLog or JSON data", "err");
      }
    };
    reader.readAsText(f);
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: "Erase LifeLog on this device",
      body: "Every project, task, session, note and habit — including the sample data — will be completely removed, leaving a blank LifeLog. There is no undo. To restore later, import a .lifelog backup or enter your 12-word recovery phrase.",
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

  const section = (title: string, sub: string, body: React.ReactNode, span = false, className?: string, isPro?: boolean) => (
    <div className={cn("card card-hover p-4 w-full min-w-0 overflow-hidden", span && "lg:col-span-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-[15px] font-bold tracking-tight">{title}</div>
        {isPro && (
          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 shrink-0">
            PRO
          </span>
        )}
      </div>
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
            {/* Pro Beta Preview Banner */}
            <div className="card engine-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[var(--line)] bg-[var(--panel)] lg:col-span-2 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-display text-[14px] font-bold text-[var(--text)]">
                  <div className="w-6 h-6 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles size={13} />
                  </div>
                  <span>Pro Themes · Free Beta Preview</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20">
                    Unlocked
                  </span>
                </div>
                <p className="text-[11.5px] font-medium text-[var(--mut)] leading-relaxed">
                  Designer boutique themes (OLED Pure Black, Tokyo Night/Day, Catppuccin, Nord, Dracula) and custom font uploads are completely unlocked during our public beta. 6 core themes (LifeLog Crimson, Warm Sepia, and Sage in both Dark &amp; Light) are permanently free forever.
                </p>
              </div>
            </div>

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

            {/* Dark Mode Themes (Curated Dark Palettes) */}
            {section(
              "Dark Mode Themes",
              "Curated rich night palettes. Pro themes are unlocked during beta preview; core LifeLog themes are permanently free.",
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
                            <div className="flex items-center gap-1 shrink-0">
                              {th.isPro && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                  PRO
                                </span>
                              )}
                              {isCurrent && (
                                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[8px] font-bold shrink-0">
                                  <Check size={8} />
                                </span>
                              )}
                            </div>
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

            {/* Light Mode Themes (Curated Light Palettes) */}
            {section(
              "Light Mode Themes",
              "Clean daylight palettes. Pro themes are unlocked during beta preview; core LifeLog themes are permanently free.",
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
                            <div className="flex items-center gap-1 shrink-0">
                              {th.isPro && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                  PRO
                                </span>
                              )}
                              {isCurrent && (
                                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[8px] font-bold shrink-0">
                                  <Check size={8} />
                                </span>
                              )}
                            </div>
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
              "Every generated colour is WCAG-checked against the background. (Pro Feature · Free in Beta)",
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

                  <Labeled label="Custom Accent Hex" hint="Pro Beta · custom hex">
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
                    <Labeled label="Background — dark mode" hint="Pro Beta">
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
                    <Labeled label="Background — light mode" hint="Pro Beta">
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
              ),
              false,
              undefined,
              true
            )}

            {/* Token Customizer */}
            {section(
              "Custom Theme Tokens",
              "Override any token. Contrast guards keep text readable; “Auto” returns to default. (Pro Feature · Free in Beta)",
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
              ),
              false,
              undefined,
              true
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
                        tag: "Low CPU/GPU · Battery-Optimized",
                        desc: "Edge-to-edge grounded bottom dock with elevated action button and native header. High performance & low resource usage.",
                        icon: Smartphone,
                      },
                      {
                        id: "liquid",
                        name: "Liquid Glass",
                        tag: "VisionOS · Higher CPU/GPU",
                        desc: "Floating pill dock with frosted multi-tier glass materials, ambient liquid illumination, and spatial Apple-style depth (uses more GPU).",
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
                      tag: "Aesthetic · Higher CPU/GPU",
                      desc: "Floating frosted glass sidebar with dynamic ambient color glow backdrop. Note: High CPU & GPU usage due to continuous blur effects.",
                      icon: Sparkles,
                    },
                    {
                      id: "planify",
                      name: "Planify Rail",
                      tag: "Compact · Low Resource",
                      desc: "Ultra-clean vertical icon rail with tooltips, maximizing horizontal canvas space with minimal CPU/GPU footprint.",
                      icon: Layers,
                    },
                    {
                      id: "control",
                      name: "Control Bar",
                      tag: "Horizontal · Low Resource",
                      desc: "Top navigation bar with quick search, clock, and full-width view layout. Lightweight and responsive.",
                      icon: SlidersHorizontal,
                    },
                    {
                      id: "desk",
                      name: "Desk Suite",
                      tag: "Pro · Low CPU/GPU (Recommended)",
                      desc: "Fixed full-height workspace sidebar with docked system status bar. Clean, fast, and highly battery-efficient.",
                      icon: LayoutDashboard,
                    },
                    {
                      id: "zen",
                      name: "Zen Cockpit",
                      tag: "Minimal · Low CPU/GPU",
                      desc: "Distraction-free cockpit with customizable modular panels. Ultra-low battery and processor consumption.",
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
                        <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 ml-0.5">
                          PRO
                        </span>
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

                  {/* P2P Infrastructure Donation Covenant Card */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                      <Heart size={14} className="text-amber-500 shrink-0" />
                      <span>P2P Relay Infrastructure & Community Covenant</span>
                    </div>
                    <p className="text-[11.5px] text-[var(--mut)] leading-relaxed">
                      Direct peer-to-peer pairing uses global WebRTC signaling relays and STUN/TURN traversal servers so devices connect instantly without port forwarding. Operating these fast, low-latency relay servers incurs recurring monthly server costs.
                    </p>
                    <p className="text-[11.5px] text-[var(--mut)] leading-relaxed">
                      If you love seamless cross-device syncing, please consider supporting development via <a href="https://buymeacoffee.com/krish1411" target="_blank" rel="noopener noreferrer" className="text-amber-400 font-semibold underline underline-offset-2">Buy Me a Coffee</a>. If relay server expenses outgrow community donations in the future, automated cloud signaling may transition into an optional Pro add-on—while offline snapshot backups, QR manual sync, and local data sovereignty will always remain 100% free and open.
                    </p>
                  </div>
                </div>
              ),
              true
            )}

            {/* Backups & Export */}
            {section(
              "Vault Backups & Migration",
              "Everything is encrypted at rest using your local device key. Export portable snapshots or create password-protected backups for safe cloud storage.",
              (
                <div className="flex flex-col gap-3">
                  {/* Universal Snapshot & Migration Card */}
                  <div className="rounded-xl border p-3.5 flex flex-col gap-3" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--text)]">
                          <Download size={15} style={{ color: "var(--accent)" }} />
                          <span>Universal Backup & Migration (.lifelog)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-mono">PC ↔ Phone</span>
                        </div>
                        <div className="text-[11.5px] text-[var(--mut)]">
                          Complete portable database snapshot with all notes, tasks, habits, and attachments. 100% compatible across Desktop, Android, and Web.
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--line)" }}>
                      <Btn
                        variant="primary"
                        onClick={handleExportLifelogSnapshot}
                        className="gap-1.5 text-xs font-bold cursor-pointer shadow-sm"
                      >
                        <Download size={13} /> Export Portable Snapshot (.lifelog)
                      </Btn>

                      <Btn
                        variant="outline"
                        onClick={() => {
                          setExportPw1("");
                          setExportPw2("");
                          setExportPwErr("");
                          setExportPwOpen(true);
                        }}
                        className="gap-1.5 text-xs font-bold cursor-pointer"
                      >
                        <Lock size={12} /> Password-Protect (.lifelog)
                      </Btn>

                      <label
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all hover:opacity-85 shadow-sm active:scale-95"
                        style={{
                          background: "var(--panel2)",
                          borderColor: "var(--line)",
                          color: "var(--text)",
                        }}
                      >
                        <Upload size={12} /> Import Backup (.lifelog / .json)
                        <input
                          type="file"
                          accept="*/*,.lifelog,.json,.sqlite3,.db,application/json,text/plain"
                          className="hidden"
                          onChange={onImportFile}
                        />
                      </label>
                    </div>

                    <div className="text-[11px] text-[var(--mut)] bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Security Tip:</strong> Unencrypted portable snapshots are intended for easy migration or trusted offline drives. Delete snapshot files after use or use password protection if uploading to cloud storage.
                      </span>
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

            {/* Software Updates & Releases */}
            {section(
              "Software Updates & Releases",
              isBrowser
                ? "LifeLog Web Edition is hosted on edge networks and is always up to date. Download our standalone desktop and mobile apps below."
                : "LifeLog has zero background telemetry and never checks for updates without your explicit request. Click below to query the official LifeLog Releases repository.",
              (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
                        <Sparkles size={18} style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-bold">
                            {isBrowser ? "LifeLog Web Edition" : "LifeLog Desktop & Mobile"}
                          </span>
                          <span className="chip !py-0.5 text-[10.5px] font-mono" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                            {isBrowser ? `v${APP_VERSION} · Always Up to Date` : `v${APP_VERSION} Sovereign`}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--mut)" }}>
                          {isBrowser
                            ? "Sandboxed Browser Storage · Zero-Cloud P2P · Always Up to Date"
                            : "Cryptographic offline vault · Native SQLite WAL · P2P DTLS Sync"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isBrowser ? (
                        <>
                          <a
                            href="https://github.com/Krrish1411/Lifelog-Releases/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary !text-xs !py-1.5 gap-1.5 font-bold cursor-pointer"
                          >
                            <Download size={13} />
                            Download App (PC & Mobile)
                          </a>
                          <a
                            href="https://github.com/Krrish1411/Lifelog-Releases/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost !text-xs !py-1.5 gap-1"
                            title="View Releases on GitHub"
                          >
                            <ExternalLink size={12} />
                            Releases
                          </a>
                        </>
                      ) : (
                        <>
                          <Btn
                            variant="primary"
                            size="sm"
                            disabled={updateChecking}
                            onClick={checkForUpdates}
                            className="gap-1.5 font-bold"
                          >
                            <RefreshCw size={13} className={cn(updateChecking && "animate-spin")} />
                            {updateChecking ? "Checking..." : "Check for Updates"}
                          </Btn>
                          <a
                            href="https://github.com/Krrish1411/Lifelog-Releases/releases"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost !text-xs !py-1.5 gap-1"
                            title="View Releases on GitHub"
                          >
                            <ExternalLink size={12} />
                            Releases
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {isBrowser && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold" style={{ borderColor: "var(--ok)", background: "rgba(16, 185, 129, 0.08)", color: "var(--ok)" }}>
                      <CheckCircle2 size={15} />
                      You are running the latest sovereign web build (v{APP_VERSION}). Refreshing the browser automatically loads latest updates.
                    </div>
                  )}

                  {!isBrowser && updateResult.status === "latest" && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold" style={{ borderColor: "var(--ok)", background: "rgba(16, 185, 129, 0.08)", color: "var(--ok)" }}>
                      <CheckCircle2 size={15} />
                      You are running the latest sovereign build (v{APP_VERSION}). Zero updates pending.
                    </div>
                  )}

                  {!isBrowser && updateResult.status === "available" && updateResult.data && (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-xl border text-[12px]" style={{ borderColor: "var(--accent)", background: "rgba(99, 102, 241, 0.08)" }}>
                      <div>
                        <div className="font-bold text-[var(--accent)] flex items-center gap-1.5">
                          <Sparkles size={14} /> LifeLog v{updateResult.data.version} is now available!
                        </div>
                        <div className="text-[11px] text-[var(--mut)] mt-0.5 font-medium">
                          Released on {updateResult.data.releaseDate}. Click to view changelog and platform binaries.
                        </div>
                      </div>
                      <Btn variant="primary" size="sm" onClick={() => setShowUpdateModal(true)}>
                        View Update
                      </Btn>
                    </div>
                  )}

                  {!isBrowser && updateResult.status === "error" && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl border text-[11.5px] font-semibold" style={{ borderColor: "var(--line)", background: "var(--panel2)", color: "var(--mut)" }}>
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>{updateResult.errorMsg}</span>
                    </div>
                  )}
                </div>
              ),
              true
            )}

            {/* Privacy-First Feedback & Community */}
            {section(
              "Feedback & Community Support",
              "Zero telemetry means your voice is the only way we learn about issues, feature wishes, and usability quirks. Reach out directly or open a GitHub issue.",
              (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={`mailto:getlifelog@proton.me?subject=${encodeURIComponent(`LifeLog Feedback & Diagnostics [v${APP_VERSION}]`)}&body=${encodeURIComponent(
                      `Hi LifeLog Team,\n\n[Describe your feedback, bug report, or idea here]\n\n---\nSystem Diagnostics (No personal, habit, or task data included):\n- App Version: v${APP_VERSION}\n- Platform: ${isNativeMobile ? "Android" : isLinuxDesktop ? "Linux Desktop" : isLinux ? "Linux" : "Desktop/Web"}\n- User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "Unknown"}\n`
                    )}`}
                    className="flex flex-col justify-between p-3.5 rounded-xl border transition-all hover:scale-[1.01] hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--text)]">
                        <Mail size={15} style={{ color: "var(--accent)" }} />
                        <span>Direct Developer Support</span>
                      </div>
                      <div className="text-[11px] font-semibold mt-1 text-[var(--mut)]">
                        Encrypted email to <span className="font-mono text-[var(--text)]">getlifelog@proton.me</span> with automatic non-identifying diagnostics.
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--accent)]">
                      <span>Send Email</span>
                      <ExternalLink size={11} />
                    </div>
                  </a>

                  <a
                    href="https://github.com/Krrish1411/Lifelog-Releases/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col justify-between p-3.5 rounded-xl border transition-all hover:scale-[1.01] hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--bg)" }}
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--text)]">
                        <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                        <span>GitHub Public Issue Tracker</span>
                      </div>
                      <div className="text-[11px] font-semibold mt-1 text-[var(--mut)]">
                        Browse open issues, propose features, and track bug fixes transparently in the public releases repo.
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-[var(--accent)]">
                      <span>Open Tracker</span>
                      <ExternalLink size={11} />
                    </div>
                  </a>
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
                    <div className="flex items-center gap-2">
                      <span className="chip text-[11px] font-mono">v{APP_VERSION} Sovereign</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "var(--mut)" }}>
                    Zero telemetry · 100% offline-first · Local SQLite WAL & IndexedDB storage · AES-256-GCM encryption · Tailored for Android & Desktop
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold">
                    <a
                      href="https://github.com/Krrish1411/Lifelog-Releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Public Releases & Downloads</span>
                      <ExternalLink size={10} />
                    </a>
                    <span className="text-[var(--line)]">·</span>
                    <a
                      href="mailto:getlifelog@proton.me"
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>getlifelog@proton.me</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              ),
              true
            )}

            {/* Support LifeLog / Monetization */}
            {section(
              "Support LifeLog",
              "LifeLog is 100% free, private, sovereign software with zero trackers, zero telemetry, and zero ads. If LifeLog helps you stay focused and organized, consider supporting its independent development.",
              (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href="https://buymeacoffee.com/Krrish1411"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] border border-black/80"
                      style={{
                        background: "#FFDD00",
                        color: "#000000",
                      }}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

                  <div className="flex items-center justify-between rounded-xl border p-3 mt-1" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                    <div>
                      <div className="text-[13px] font-bold">Milestone Supporter Prompts</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
                        Show an occasional coffee reminder after reaching major milestones (e.g. 10 completed tasks or 5 hours of deep focus).
                      </div>
                    </div>
                    <Toggle checked={!s.muteSupportPrompt} onChange={(v) => patch({ muteSupportPrompt: !v })} />
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
              "Local-only means local-only: there is no cloud copy to restore from. Erasing removes everything — sample data included — and you start from a blank LifeLog. Restore by importing a .lifelog backup or entering your 12-word recovery phrase.",
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

      {/* Unencrypted Snapshot Export Advisory Modal */}
      <Modal
        open={showUnencryptedWarningModal}
        onClose={() => setShowUnencryptedWarningModal(false)}
        title="⚠️ Unencrypted Portable Snapshot Exported"
        width={480}
        footer={
          <Btn variant="primary" onClick={() => setShowUnencryptedWarningModal(false)} className="font-bold">
            Got it, I understand
          </Btn>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--text)] font-semibold">
            Your complete LifeLog database snapshot has been exported to your downloads as a portable <code className="px-1.5 py-0.5 rounded bg-[var(--panel2)] font-mono text-xs">.lifelog</code> file.
          </p>

          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2 text-xs text-[var(--text)]">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <AlertCircle size={15} />
              <span>Important Security & Privacy Advice</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[var(--mut)] font-medium leading-relaxed">
              <li><strong className="text-[var(--text)]">Unencrypted by Design:</strong> This file is not password-protected so you can freely restore or migrate across devices with 0 passwords.</li>
              <li><strong className="text-[var(--text)]">Delete After Use:</strong> Once you import this file on your target device, permanently delete this snapshot from your computer or downloads folder.</li>
              <li><strong className="text-[var(--text)]">Trusted Storage Only:</strong> Keep it temporarily on trusted offline drives or USB sticks. Do <em>not</em> upload to public clouds or email.</li>
              <li><strong className="text-[var(--text)]">For Cloud Storage:</strong> If you want to backup to Google Drive or Dropbox, use the <strong className="text-[var(--text)]">Password-Protect (.lifelog)</strong> option instead.</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Password-Protect Backup Modal */}
      <Modal
        open={exportPwOpen}
        onClose={() => {
          setExportPwOpen(false);
          setExportPw1("");
          setExportPw2("");
          setExportPwErr("");
        }}
        title="🔒 Password-Protect Backup (.lifelog)"
        width={440}
        footer={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                setExportPwOpen(false);
                setExportPw1("");
                setExportPw2("");
                setExportPwErr("");
              }}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={!exportPw1 || !exportPw2}
              onClick={handleExportPasswordProtected}
              className="gap-1.5 font-bold"
            >
              <Lock size={12} /> Encrypt & Export
            </Btn>
          </>
        }
      >
        <p className="text-[12.5px] font-semibold text-[var(--mut)] mb-3">
          Create a sealed AES-256-GCM encrypted backup. Safe to upload to Google Drive, Dropbox, or send via email.
        </p>
        <div className="space-y-2.5">
          <input
            type="password"
            className="inp w-full text-xs"
            placeholder="Master password (min 4 characters)"
            value={exportPw1}
            onChange={(e) => {
              setExportPw1(e.target.value);
              setExportPwErr("");
            }}
          />
          <input
            type="password"
            className="inp w-full text-xs"
            placeholder="Confirm master password"
            value={exportPw2}
            onChange={(e) => {
              setExportPw2(e.target.value);
              setExportPwErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleExportPasswordProtected()}
          />
        </div>
        {exportPwErr && (
          <div className="mt-2 text-[12px] font-bold text-red-400">
            {exportPwErr}
          </div>
        )}
      </Modal>

      {/* Update Available / Details Modal */}
      {updateResult.data && (
        <Modal
          open={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          title={`🚀 LifeLog v${updateResult.data.version} Available`}
          width={520}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-mono text-[var(--mut)]">
                Released {updateResult.data.releaseDate}
              </span>
              <Btn variant="primary" onClick={() => setShowUpdateModal(false)} className="font-bold">
                Close
              </Btn>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-[var(--text)]">
              <div className="font-bold text-indigo-400 mb-1">What's New in v{updateResult.data.version}:</div>
              <ul className="list-disc list-inside space-y-1 text-[var(--text)] font-medium">
                {updateResult.data.changelog.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[12px] font-bold text-[var(--text)] mb-2">Direct Platform Downloads:</div>
              <div className="grid grid-cols-2 gap-2">
                {updateResult.data.downloads.windows && (
                  <a
                    href={updateResult.data.downloads.windows}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  >
                    <span>Windows (.exe)</span>
                    <Download size={13} style={{ color: "var(--accent)" }} />
                  </a>
                )}
                {updateResult.data.downloads.mac && (
                  <a
                    href={updateResult.data.downloads.mac}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  >
                    <span>macOS (.dmg)</span>
                    <Download size={13} style={{ color: "var(--accent)" }} />
                  </a>
                )}
                {updateResult.data.downloads.linux && (
                  <a
                    href={updateResult.data.downloads.linux}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  >
                    <span>Linux (.AppImage)</span>
                    <Download size={13} style={{ color: "var(--accent)" }} />
                  </a>
                )}
                {updateResult.data.downloads.android && (
                  <a
                    href={updateResult.data.downloads.android}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--line)", background: "var(--panel2)" }}
                  >
                    <span>Android (.apk)</span>
                    <Download size={13} style={{ color: "var(--accent)" }} />
                  </a>
                )}
              </div>
            </div>

            <div className="text-[11px] text-[var(--mut)] font-medium">
              You can also download signed checksums and source archives on the{" "}
              <a
                href="https://github.com/Krrish1411/Lifelog-Releases/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline font-bold"
              >
                GitHub Releases page
              </a>.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
