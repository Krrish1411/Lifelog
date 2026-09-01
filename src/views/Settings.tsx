import { useEffect, useState } from "react";
import { Bell, Download, Keyboard, Lock, Palette, Quote, RotateCcw, Trash2, Upload } from "lucide-react";
import type { LayoutMode, State, ThemeMode, TokenKey } from "../types";
import {
  DEFAULT_SETTINGS, DEFAULT_SHORTCUTS, FONT_PAIRS, QUOTES, REPORT_WIDGETS, SHORTCUT_ACTIONS, STATE_VERSION,
} from "../types";
import { ERASED_KEY, useApp } from "../store";
import { decryptBackup, decryptEnvelope, encryptBackup, getDeviceKey } from "../utils/crypto";
import { contrast, download, ensureContrast, normalizeHex, todayIso } from "../utils/core";
import { CUSTOM_FONT_FAMILY, readFileAsDataUrl, saveCustomFont } from "../utils/fonts";
import { Btn, ColorPicker, Labeled, Modal, Seg, TextInput, Toggle, cn } from "../components/ui";

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
  const { state, set, toast, confirm } = app;
  const s = state.settings;
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [importPwOpen, setImportPwOpen] = useState(false);
  const [importPw, setImportPw] = useState("");
  const [importPayload, setImportPayload] = useState<string | null>(null);
  const [importErr, setImportErr] = useState("");
  const [quotesDraft, setQuotesDraft] = useState(s.customQuotes.join("\n"));
  useEffect(() => setQuotesDraft(s.customQuotes.join("\n")), [s.customQuotes]);

  const patch = (p: Partial<typeof s>) => set((st) => ({ ...st, settings: { ...st.settings, ...p } }));
  const setToken = (k: TokenKey, hex: string | null) => {
    set((st) => {
      const tokens = { ...st.settings.tokens };
      if (hex === null) delete tokens[k];
      else tokens[k] = hex;
      return { ...st, settings: { ...st.settings, tokens } };
    });
  };

  const dark = s.themeMode === "dark";
  const bgNow = normalizeHex(dark ? s.bgDark : s.bgLight) ?? (dark ? "#0f1714" : "#eef1ee");
  const tokenDefault = (k: TokenKey): string => {
    if (k === "text") return dark ? "#e8efe9" : "#182019";
    if (k === "mut") return dark ? "#8fa396" : "#5c6a60";
    if (k === "panel") return dark ? "#16211c" : "#ffffff";
    if (k === "panel2") return dark ? "#1d2b24" : "#f7faf7";
    if (k === "line") return dark ? "#26382f" : "#d7ded8";
    if (k === "ok") return dark ? "#6fbf8e" : "#3e8f60";
    if (k === "warn") return dark ? "#e0b457" : "#a67c1f";
    return dark ? "#d66853" : "#b23c28";
  };
  const accentRatio = contrast(ensureContrast(normalizeHex(s.accent) ?? s.accent, bgNow, 4.5), bgNow).toFixed(1);

  /* ---------------- layout engines ---------------- */
  const engines: { id: LayoutMode; name: string; desc: string }[] = [
    { id: "glass", name: "Liquid Glass", desc: "Blurred translucent panels over a slow liquid colour field." },
    { id: "planify", name: "Planify", desc: "Slim icon rail, airy single column, minimal chrome." },
    { id: "desk", name: "Desk", desc: "Classic labelled workspace sidebar plus a live status bar." },
    { id: "control", name: "Control", desc: "Dense command bar up top, tabular numbers, status strip." },
    { id: "zen", name: "Zen", desc: "Edge-to-edge cockpit home with customisable panels." },
  ];

  /* ---------------- data ---------------- */
  const exportPlain = () => {
    download(`lifelog-export-${todayIso()}.json`, JSON.stringify(state, null, 2));
    toast("Plain JSON exported — full history included", "ok");
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
    localStorage.setItem(ERASED_KEY, "1"); // boot into a blank app, never reseed
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  };

  const notifStatus = !("Notification" in window) ? "unsupported"
    : Notification.permission === "granted" ? "granted"
    : Notification.permission === "denied" ? "denied" : "default";
  const enableNotifs = async () => {
    if (!("Notification" in window)) return toast("This browser has no Notification API", "err");
    const perm = await Notification.requestPermission();
    if (perm === "granted") { patch({ notifyEnabled: true }); toast("Desktop notifications on — reminders fire while LifeLog is open", "ok"); }
    else toast("Permission denied — in-app toasts will still appear", "warn");
  };

  const saveQuotes = () => {
    const lines = quotesDraft.split("\n").map((q) => q.trim()).filter(Boolean);
    patch({ customQuotes: lines });
    toast(lines.length ? `${lines.length} personal line(s) saved — mixed into the greeting` : "Personal quotes cleared", "ok");
  };

  const section = (title: string, sub: string, body: React.ReactNode, span = false) => (
    <div className={cn("card card-hover p-4", span && "lg:col-span-2")}>
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
        {section("Interface engine", "Five genuinely different structures — switch any time, content is preserved.", (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {engines.map((l) => (
              <button key={l.id} onClick={() => { patch({ layout: l.id }); toast(`Interface switched to ${l.name}`, "ok"); }}
                className="rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5"
                style={s.layout === l.id ? { borderColor: "var(--accent)", background: "var(--accent-soft)", cursor: "pointer" } : { borderColor: "var(--line)", cursor: "pointer" }}>
                <div className="flex items-center gap-1.5 text-[12.5px] font-bold">
                  {l.name}
                  {s.layout === l.id && <span className="ml-auto h-[7px] w-[7px] rounded-full" style={{ background: "var(--accent)" }} />}
                </div>
                <div className="mt-1 text-[10.5px] font-semibold leading-snug" style={{ color: "var(--mut)" }}>{l.desc}</div>
              </button>
            ))}
          </div>
        ), true)}

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
            <Labeled label="Accent colour" hint="custom hex always available"><ColorPicker value={s.accent} onChange={(hex) => patch({ accent: hex })} /></Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Background — dark mode">
                <ColorPicker value={s.bgDark} onChange={(hex) => patch({ bgDark: hex })} />
              </Labeled>
              <Labeled label="Background — light mode">
                <ColorPicker value={s.bgLight} onChange={(hex) => patch({ bgLight: hex })} />
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

        {section("Keyboard shortcuts", "Work without touching the mouse. Click a key, then press the new one (Esc cancels).", (
          <div className="flex flex-col gap-1.5">
            {SHORTCUT_ACTIONS.map((a) => (
              <div key={a.action} className="flex items-center justify-between rounded-xl border px-3 py-1.5" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
                <span className="text-[12.5px] font-bold">{a.label}</span>
                <ShortcutKey k={s.shortcuts[a.action] ?? ""} onChange={(k) => {
                  patch({ shortcuts: { ...s.shortcuts, [a.action]: k } });
                  toast(`“${a.label}” → ${k === " " ? "space" : k}`, "ok");
                }} />
              </div>
            ))}
            <Btn size="sm" variant="ghost" className="self-start" onClick={() => { patch({ shortcuts: { ...DEFAULT_SHORTCUTS } }); toast("Shortcuts reset", "ok"); }}>
              <RotateCcw size={12} /> Reset defaults
            </Btn>
          </div>
        ))}

        {section("Reminders & notifications", "Lead time applies to time-blocks and snoozed tasks, and fires while LifeLog is open.", (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Labeled label="Remind me … minutes before">
                <TextInput type="number" min={0} max={180} className="w-[110px]" value={String(s.reminderLeadMin)}
                  onChange={(e) => patch({ reminderLeadMin: Math.max(0, Math.min(180, parseInt(e.target.value || "0", 10))) })} />
              </Labeled>
              <span className="chip text-[10.5px]" style={{ color: notifStatus === "granted" ? "var(--ok)" : notifStatus === "denied" ? "var(--danger)" : "var(--mut)" }}>
                <Bell size={10} /> browser permission: {notifStatus}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg)" }}>
              <Toggle checked={s.notifyEnabled} onChange={(v) => { if (v && notifStatus !== "granted") enableNotifs(); else patch({ notifyEnabled: v }); }} label="Native desktop notifications" />
              {!s.notifyEnabled && <Btn size="sm" variant="primary" onClick={enableNotifs}><Bell size={12} /> Enable</Btn>}
              <span className="text-[10.5px] font-semibold" style={{ color: "var(--mut)" }}>In-app toasts always appear, with or without permission.</span>
            </div>
          </div>
        ))}

        {section("Timer defaults", "Used by the Focus stage — pomodoro length, break length, countdown default.", (
          <div className="flex flex-wrap items-end gap-4">
            <Labeled label="Pomodoro (min)">
              <TextInput type="number" min={5} max={120} className="w-[92px]" value={String(s.pomodoroMin)}
                onChange={(e) => patch({ pomodoroMin: Math.max(5, Math.min(120, parseInt(e.target.value || "25", 10))) })} />
            </Labeled>
            <Labeled label="Break (min)">
              <TextInput type="number" min={1} max={60} className="w-[92px]" value={String(s.breakMin)}
                onChange={(e) => patch({ breakMin: Math.max(1, Math.min(60, parseInt(e.target.value || "5", 10))) })} />
            </Labeled>
            <Labeled label="Countdown default (min)">
              <TextInput type="number" min={1} max={480} className="w-[92px]" value={String(s.countdownMin)}
                onChange={(e) => patch({ countdownMin: Math.max(1, Math.min(480, parseInt(e.target.value || "45", 10))) })} />
            </Labeled>
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

      <span className="hidden"><Keyboard size={1} /></span>
    </div>
  );
}

/* ---------------- key-capture control ---------------- */
function ShortcutKey({ k, onChange }: { k: string; onChange: (key: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (!capturing) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setCapturing(false); return; }
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      onChange(e.key === " " ? "space" : e.key.toLowerCase());
      setCapturing(false);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [capturing, onChange]);
  return (
    <button onClick={() => setCapturing((v) => !v)}
      className={cn("min-w-[64px] rounded-lg border px-2.5 py-1 font-mono text-[12px] font-bold transition-all")}
      style={capturing
        ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-soft)", cursor: "pointer" }
        : { borderColor: "var(--line)", background: "var(--panel2)", color: "var(--text)", cursor: "pointer" }}>
      {capturing ? "press a key…" : k === "space" ? "␣ space" : k || "—"}
    </button>
  );
}
