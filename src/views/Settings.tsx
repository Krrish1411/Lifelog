import { useEffect, useState } from "react";
import { Bell, Download, Lock, Palette, Quote, RotateCcw, Sparkles, Trash2, Upload, Volume2, Radio, Layers, SlidersHorizontal, LayoutDashboard, Compass } from "lucide-react";
import type { LayoutMode, State, ThemeMode, TokenKey } from "../types";
import {
  DEFAULT_SETTINGS, FONT_PAIRS, QUOTES, REPORT_WIDGETS, STATE_VERSION,
} from "../types";
import { ERASED_KEY, useApp } from "../store";
import { decryptBackup, decryptEnvelope, decryptText, encryptBackup, getDeviceKey } from "../utils/crypto";
import { contrast, download, ensureContrast, normalizeHex, todayIso } from "../utils/core";
import { CUSTOM_FONT_FAMILY, readFileAsDataUrl, saveCustomFont } from "../utils/fonts";
import { clearIDB, saveErasedFlag } from "../utils/idb";
import { Btn, ColorPicker, Labeled, Modal, Seg, TextInput, Toggle, cn } from "../components/ui";
import { playTimerFinishSound, playTimerStartSound } from "../utils/audio";
import {
  checkNativeNotificationPermission,
  isNative,
  playChimeSound,
  requestNativeNotificationPermission,
  sendNativeTestNotification,
  triggerHaptic,
} from "../utils/native";

const LS_KEY = "lifelog.state.v1";

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

  /* ---------------- mobile accent presets ---------------- */
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
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      try {
        const env = JSON.parse(text) as { kind?: string };
        if (env?.kind === "backup") {
          setImportPayload(text); setImportPw(""); setImportErr(""); setImportPwOpen(true);
          return;
        }
        await finishImport(text, null);
      } catch {
        toast("Could not read that file — not valid JSON", "err");
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
      // Clear IndexedDB first
      await clearIDB();
    } catch {}

    // Purge service worker caches (CacheStorage)
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

      // Set erased flag so initial sample data is not regenerated
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

  const saveQuotes = () => {
    const lines = quotesDraft.split("\n").map((q) => q.trim()).filter(Boolean);
    patch({ customQuotes: lines });
    toast(lines.length ? `${lines.length} personal line(s) saved — mixed into the greeting` : "Personal quotes cleared", "ok");
  };

  const section = (title: string, sub: string, body: React.ReactNode, span = false, className?: string) => (
    <div className={cn("card card-hover p-4", span && "lg:col-span-2", className)}>
      <div className="font-display text-[15px] font-bold tracking-tight">{title}</div>
      <div className="mb-3 text-[11.5px] font-semibold" style={{ color: "var(--mut)" }}>{sub}</div>
      {body}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight">Settings</h1>
        <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
          Interface engines, every colour, text scale, shortcuts and your data — all local, all yours.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {section(
          "Desktop Interface Engine",
          "Choose your preferred layout on tablets, laptops, and desktop displays (≥ 768px). Mobile phones automatically use the ergonomic bottom dock & drawer.",
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
                  desc: "Top navigation bar with quick search, clock, and full-width edge-to-edge view layout.",
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
                    <p className="text-[11.5px] leading-relaxed text-[var(--mut)] mt-1">
                      {eng.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          ),
          true,
          "hidden md:block"
        )}

        {section("Profile", "Used in greetings across the app.", (
          <div className="flex items-end gap-3">
            <Labeled label="Your name">
              <TextInput value={s.profileName} onChange={(e) => patch({ profileName: e.target.value })} placeholder="e.g. Krish Patel" />
            </Labeled>
            <div className="rounded-xl border px-3 py-2 text-[12.5px] font-bold" style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--accent)" }}>
              “Good morning{s.profileName.trim() ? `, ${s.profileName.trim()}` : ""}”
            </div>
          </div>
        ))}

        {section("Theme — mode, accent & background", "Every generated colour is WCAG-checked against the background.", (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <Seg options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} value={s.themeMode} onChange={(v: ThemeMode) => patch({ themeMode: v })} />
              <span className="chip text-[10px]" style={{ color: parseFloat(accentRatio) >= 4.5 ? "var(--ok)" : "var(--warn)" }}>
                <Palette size={10} /> accent contrast {accentRatio}:1
              </span>
            </div>

            {/* Quick Accent Presets */}
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
                  <Btn size="sm" variant="ghost" onClick={() => { patch({ accent: DEFAULT_SETTINGS.accent }); toast("Accent reset to default", "ok"); }} title="Reset accent to default">
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
                    <Btn size="sm" variant="ghost" onClick={() => { patch({ bgDark: DEFAULT_SETTINGS.bgDark }); toast("Dark background reset", "ok"); }} title="Reset dark background to default">
                      <RotateCcw size={12} /> Reset
                    </Btn>
                  )}
                </div>
              </Labeled>
              <Labeled label="Background — light mode">
                <div className="flex items-center gap-2">
                  <ColorPicker value={s.bgLight} onChange={(hex) => patch({ bgLight: hex })} />
                  {s.bgLight.toLowerCase() !== DEFAULT_SETTINGS.bgLight.toLowerCase() && (
                    <Btn size="sm" variant="ghost" onClick={() => { patch({ bgLight: DEFAULT_SETTINGS.bgLight }); toast("Light background reset", "ok"); }} title="Reset light background to default">
                      <RotateCcw size={12} /> Reset
                    </Btn>
                  )}
                </div>
              </Labeled>
            </div>
          </div>
        ))}

        {section("Theme — every other colour", "Override any token. Contrast guards keep text readable; “Auto” returns to the generated default.", (
          <div className="flex flex-col gap-2">
            {TOKEN_ROWS.map((r) => {
              const overridden = !!s.tokens[r.key];
              return (
                <div key={r.key} className="flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                  <span className="h-6 w-6 shrink-0 rounded-lg border" style={{ background: s.tokens[r.key] ?? tokenDefault(r.key), borderColor: "var(--line)" }} />
                  <div className="w-[168px] shrink-0">
                    <div className="text-[12.5px] font-bold">{r.label}</div>
                    <div className="text-[10px] font-semibold" style={{ color: "var(--mut)" }}>{r.desc}</div>
                  </div>
                  <ColorPicker value={s.tokens[r.key] ?? tokenDefault(r.key)} onChange={(hex) => setToken(r.key, hex)} />
                  {overridden && (
                    <Btn size="sm" variant="ghost" onClick={() => setToken(r.key, null)} title="Back to auto"><RotateCcw size={11} /> Auto</Btn>
                  )}
                </div>
              );
            })}
            <Btn size="sm" variant="ghost" className="self-start" onClick={() => { patch({ tokens: {}, accent: DEFAULT_SETTINGS.accent, bgDark: DEFAULT_SETTINGS.bgDark, bgLight: DEFAULT_SETTINGS.bgLight }); toast("All colours reset to auto", "ok"); }}>
              <RotateCcw size={12} /> Reset all colours
            </Btn>
          </div>
        ))}

        {section("Text size & typeface", "Scale applies to the whole content area — every heading, label, input and note. The sidebar shell stays fixed.", (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="lbl mb-0">Content scale</span>
                <span className="font-mono text-[15px] font-bold tnum" style={{ color: "var(--accent)" }}>{s.uiZoom}%</span>
              </div>
              <input type="range" min={100} max={200} step={5} value={s.uiZoom}
                onChange={(e) => patch({ uiZoom: parseInt(e.target.value, 10) })} className="energy" />
              <div className="mt-1 flex justify-between text-[10px] font-bold" style={{ color: "var(--mut)" }}>
                <span>100% compact</span><span>200% large display</span>
              </div>
            </div>
            <Labeled label="Typeface" hint="applies to headings, body and your notes">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FONT_PAIRS) as (keyof typeof FONT_PAIRS)[]).map((fp) => (
                  <button key={fp} onClick={() => patch({ fontPair: fp, customFontName: null })}
                    className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold transition-all"
                    style={{
                      fontFamily: `'${FONT_PAIRS[fp].family}', sans-serif`,
                      borderColor: s.fontPair === fp && !s.customFontName ? "var(--accent)" : "var(--line)",
                      color: s.fontPair === fp && !s.customFontName ? "var(--accent)" : "var(--text)",
                      background: s.fontPair === fp && !s.customFontName ? "var(--accent-soft)" : "var(--bg)",
                      cursor: "pointer",
                    }}>
                    {FONT_PAIRS[fp].label.replace(" (default)", "")}
                  </button>
                ))}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-[12px] font-bold transition-all hover:opacity-80"
                  style={{ borderColor: s.customFontName ? "var(--accent)" : "var(--line)", color: s.customFontName ? "var(--accent)" : "var(--mut)" }}>
                  <Upload size={12} /> {s.customFontName ? `Custom: ${CUSTOM_FONT_FAMILY}` : "Upload font (.ttf/.otf/.woff2)"}
                  <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={async (e) => {
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
                  }} />
                </label>
              </div>
            </Labeled>
          </div>
        ))}

        {section("Accessibility", "Make LifeLog comfortable for everyone — motion, transparency and contrast controls.", (
          <div className="flex flex-col gap-3">
            <Toggle checked={s.reduceMotion} onChange={(v) => patch({ reduceMotion: v })} label="Reduce motion" />
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>Minimizes animations and transitions throughout the app.</span>
            
            <Toggle checked={s.reduceTransparency} onChange={(v) => patch({ reduceTransparency: v })} label="Reduce transparency" />
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>Removes blur effects and makes panels more opaque.</span>
            
            <Toggle checked={s.highContrast} onChange={(v) => patch({ highContrast: v })} label="High contrast" />
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>Increases border thickness and contrast for better visibility.</span>
          </div>
        ))}

        {section("Greeting & motivation", "Shown at launch with a quote — built-ins mixed with your own lines.", (
          <div className="flex flex-col gap-3">
            <Seg
              options={[{ value: "daily", label: "First launch of the day only" }, { value: "every", label: "Every launch" }]}
              value={s.greeting}
              onChange={(v) => patch({ greeting: v })}
            />
            <div className="flex items-start gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
              <Quote size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <span className="text-[12.5px] font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
                {QUOTES[Math.floor(Math.random() * QUOTES.length)]}
              </span>
            </div>
            <Labeled label="Your own lines (one per line)" hint="mixed randomly with the built-ins">
              <textarea className="inp min-h-[84px] resize-y" value={quotesDraft} onChange={(e) => setQuotesDraft(e.target.value)}
                placeholder={"Show up for the hard hour.\nSmall logs, big clarity."} />
            </Labeled>
            <Btn size="sm" variant="primary" className="self-start" onClick={saveQuotes}>Save quotes</Btn>
          </div>
        ))}

        {section("Android Mobile Experience", "Mobile-optimized architecture with local-only storage and native system bars.", (
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
        ))}

        {section(
          "Reminders & notifications",
          "Background alarms for tasks and focus sessions with exact wakeup and in-app chime sound.",
          (
            <div className="flex flex-col gap-3">
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
                  <Bell size={10} /> {isNative ? "Android permission" : "Browser permission"}:{" "}
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
                    label="Enable notifications (Background & Exact Alarms)"
                  />
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                    {isNative
                      ? "Uses Android AlarmManager to trigger alarms even if the app is killed or device reboots."
                      : "Fires desktop notifications and browser alerts."}
                  </span>
                </div>
                {!s.notifyEnabled && (
                  <Btn size="sm" variant="primary" onClick={enableNotifs}>
                    <Bell size={12} /> Enable
                  </Btn>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Btn
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await sendNativeTestNotification();
                    toast("Test notification sent & bell chime played!", "ok");
                  }}
                  className="gap-1.5 text-[11.5px]"
                >
                  <Volume2 size={13} /> Test Notification
                </Btn>
                <Btn
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    playTimerStartSound();
                    toast("Played start chime", "ok");
                  }}
                  className="gap-1.5 text-[11.5px]"
                >
                  <Volume2 size={13} /> Test Start Chime
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
                  <Volume2 size={13} /> Test Finish Chime
                </Btn>
              </div>
            </div>
          )
        )}

        {section("Timer defaults", "Used by the Focus stage — pomodoro length, break length, countdown default.", (
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
        ))}

        {section("Welcome guide & product tour", "Explore LifeLog's architecture, 7 core feature pillars, and honest day workflow anytime.", (
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
        ))}

        {section("Report widgets", "Choose what appears in Reports — the grid reflows as you toggle.", (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REPORT_WIDGETS.map((rw) => (
              <div key={rw.key} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                <div>
                  <div className="text-[12.5px] font-bold">{rw.label}</div>
                  <div className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>{rw.desc}</div>
                </div>
                <Toggle checked={!!s.reportWidgets[rw.key]} onChange={(v) => patch({ reportWidgets: { ...s.reportWidgets, [rw.key]: v } })} />
              </div>
            ))}
          </div>
        ), true)}

        {section("Device-to-Device Sync (P2P)", "End-to-end encrypted (AES-256-GCM) direct synchronization between your phone and computer without any cloud servers.", (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
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
        ), true)}

        {section("Data — export, backup, import", "Everything lives on this device. Exports are plain JSON; backups add a master-password layer (PBKDF2 + AES-256-GCM).", (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Btn variant="soft" onClick={exportPlain}><Download size={13} /> Export JSON (full history)</Btn>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 py-[7px] text-[13px] font-bold transition-all hover:opacity-85"
                style={{ background: "var(--panel2)", borderColor: "var(--line)", color: "var(--text)" }}>
                <Upload size={13} /> Import file
                <input type="file" accept=".json,.lifelog,application/json" className="hidden" onChange={onImportFile} />
              </label>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
              <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                <Lock size={12} /> Encrypted backup with master password
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="password" className="inp w-[170px]" placeholder="Master password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
                <input type="password" className="inp w-[170px]" placeholder="Repeat password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                <Btn variant="primary" onClick={makeBackup}><Download size={13} /> Download .lifelog</Btn>
              </div>
              <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                Includes task creation times, every session start/pause/complete timestamp, notes with attachments and habits — enough to fully reconstruct your history.
              </div>
            </div>
          </div>
        ), true)}

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
                    Crafted with precision by <span className="font-bold text-accent">Krish Patel</span>
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

        {section(
          "Danger zone",
          "Local-only means local-only: there is no cloud copy to restore from. Erasing removes everything — sample data included — and you start from a blank LifeLog. Restore by importing an encrypted .lifelog backup with its master password.",
          (
            <div className="flex flex-col gap-2">
              <Btn variant="danger" onClick={resetAll}><Trash2 size={13} /> Erase all data — start blank</Btn>
              <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>
                You will be asked to type DELETE to confirm.
              </span>
            </div>
          ),
        )}
      </div>

      <Modal open={importPwOpen} onClose={() => { setImportPwOpen(false); setImportPayload(null); }}
        title="Encrypted backup — enter master password" width={420}
        footer={
          <>
            <Btn variant="ghost" onClick={() => { setImportPwOpen(false); setImportPayload(null); }}>Cancel</Btn>
            <Btn variant="primary" disabled={!importPw} onClick={() => importPayload && finishImport(importPayload, importPw)}>
              <Lock size={12} /> Decrypt & import
            </Btn>
          </>
        }>
        <p className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
          This backup was sealed with a master password. It never touches any server — decryption happens right here.
        </p>
        <input autoFocus type="password" className="inp mt-3" placeholder="Master password"
          value={importPw} onChange={(e) => { setImportPw(e.target.value); setImportErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && importPayload && importPw && finishImport(importPayload, importPw)} />
        {importErr && <div className="mt-2 text-[12px] font-bold" style={{ color: "var(--danger)" }}>{importErr}</div>}
      </Modal>

    </div>
  );
}
