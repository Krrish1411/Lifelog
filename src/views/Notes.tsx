import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Film, FolderPlus, Heading1, Heading2, Highlighter, ImageIcon, Italic, Link2,
  List, ListOrdered, ListTodo, Lock, Maximize2, Mic, Minimize2, Minus, Paperclip,
  Pin, PinOff, Plus, Quote, Square, Strikethrough, Trash2, Underline,
} from "lucide-react";
import type { Attachment, Note } from "../types";
import { useApp } from "../store";
import { decryptText, encryptText, getDeviceKey } from "../utils/crypto";
import { fmtClock, fmtDayShort, fmtNoteName, todayIso, uid } from "../utils/core";
import { applyLinePrefix, applyWrap, renderMarkdown } from "../utils/markdown";
import { consumeDailyNote } from "../utils/nav";
import { Btn, EmptyState, Modal, SearchInput, Seg, TextInput, cn } from "../components/ui";

interface Draft { title: string; text: string }
const MAX_ATTACH = 3 * 1024 * 1024; // 3 MB per attachment (local storage friendly)

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function NotesView() {
  const { state, set, toast, confirm } = useApp();
  const today = todayIso();
  const [folderSel, setFolderSel] = useState<string>("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>({ title: "", text: "" });
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [popped, setPopped] = useState(false);
  const [preview, setPreview] = useState<"write" | "preview">("write");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [recSec, setRecSec] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const recTimer = useRef<number | null>(null);
  const loadedFor = useRef<string | null>(null);
  const dirty = useRef(false);

  /* ensure today's daily note + cross-view request */
  useEffect(() => {
    if (!state.notes.some((n) => n.daily && n.day === today)) {
      const note: Note = { id: uid(), title: fmtNoteName(today), folderId: "f-daily", createdAt: Date.now(), updatedAt: Date.now(), blob: { plain: "" }, daily: true, day: today };
      set((s) => (s.notes.some((n) => n.daily && n.day === today) ? s : { ...s, notes: [note, ...s.notes] }));
    }
    const requested = consumeDailyNote();
    const targetIso = requested ?? today;
    const existing = state.notes.find((n) => n.daily && n.day === targetIso);
    if (existing) setSelId(existing.id);
    else if (requested) {
      const id = uid();
      set((s) => ({ ...s, notes: [{ id, title: fmtNoteName(requested), folderId: "f-daily", createdAt: Date.now(), updatedAt: Date.now(), blob: { plain: "" }, daily: true, day: requested }, ...s.notes] }));
      setSelId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* load + decrypt selected note */
  useEffect(() => {
    if (!selId) return;
    const note = state.notes.find((n) => n.id === selId);
    if (!note || loadedFor.current === selId) return;
    loadedFor.current = selId;
    dirty.current = false;
    setDraft({ title: note.title, text: "" });
    getDeviceKey().then((k) => decryptText(k, note.blob)).then((text) => {
      setDraft((d) => (loadedFor.current === selId ? { ...d, text } : d));
    });
  }, [selId, state.notes]);

  /* autosave (debounced, re-encrypts) */
  useEffect(() => {
    if (!selId || loadedFor.current !== selId) return;
    const note = state.notes.find((n) => n.id === selId);
    if (!note) return;
    const titleChanged = draft.title.trim() !== "" && draft.title !== note.title;
    if (!titleChanged && !dirty.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const key = await getDeviceKey();
      const blob = await encryptText(key, draft.text);
      set((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === selId ? { ...n, title: draft.title.trim() || n.title, blob, updatedAt: Date.now() } : n)),
      }));
      dirty.current = false;
      setSaveState("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [draft, selId, state.notes, set]);

  /* stop recording on unmount */
  useEffect(() => () => { stopRecording(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const notes = useMemo(() => {
    let list = state.notes;
    if (folderSel !== "all") list = list.filter((n) => n.folderId === folderSel);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((n) => n.title.toLowerCase().includes(q));
    return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [state.notes, folderSel, query]);

  const selNote = state.notes.find((n) => n.id === selId);
  const folders = useMemo(
    () => [...state.folders].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.name.localeCompare(b.name)),
    [state.folders],
  );

  const createNote = () => {
    const id = uid();
    const folderId = folderSel !== "all" ? folderSel : state.folders.find((f) => f.id !== "f-daily")?.id ?? "f-daily";
    set((s) => ({ ...s, notes: [{ id, title: "Untitled note", folderId, createdAt: Date.now(), updatedAt: Date.now(), blob: { plain: "" }, daily: false, day: null }, ...s.notes] }));
    loadedFor.current = null;
    setSelId(id);
    toast("Note created — encrypted as you type", "ok");
  };
  const deleteNote = async (n: Note) => {
    const ok = await confirm({ title: "Delete note", body: `“${n.title}” and its ${n.attachments?.length ?? 0} attachment(s) will be permanently removed from local storage.`, confirmLabel: "Delete note", danger: true });
    if (!ok) return;
    set((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== n.id) }));
    if (selId === n.id) { setSelId(null); loadedFor.current = null; }
    toast("Note deleted", "warn");
  };
  const togglePinNote = (n: Note) => {
    set((s) => ({ ...s, notes: s.notes.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)) }));
    toast(n.pinned ? "Unpinned" : "Pinned to top", "ok");
  };
  const togglePinFolder = (id: string, pinned?: boolean) =>
    set((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, pinned: !pinned } : f)) }));
  const addFolder = () => {
    const v = newFolder.trim();
    if (!v) return;
    set((s) => ({ ...s, folders: [...s.folders, { id: uid(), name: v }] }));
    setNewFolder(""); setShowNewFolder(false);
    toast("Folder added", "ok");
  };
  const deleteFolder = async (id: string) => {
    const count = state.notes.filter((n) => n.folderId === id).length;
    if (count > 0) return toast(`Folder still has ${count} note(s) — move or delete them first`, "err");
    const ok = await confirm({ title: "Delete folder", body: "This empty folder will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    set((s) => ({ ...s, folders: s.folders.filter((f) => f.id !== id) }));
    setFolderSel("all");
  };

  /* ---------------- attachments ---------------- */
  const pushAttachment = (a: Attachment) => {
    if (!selId) return;
    set((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === selId ? { ...n, attachments: [...(n.attachments ?? []), a], updatedAt: Date.now() } : n)),
    }));
    toast(`${a.kind === "image" ? "Photo" : a.kind === "video" ? "Video" : "Audio"} attached — encrypted with the note`, "ok");
  };
  const removeAttachment = (id: string) => {
    if (!selId) return;
    set((s) => ({ ...s, notes: s.notes.map((n) => (n.id === selId ? { ...n, attachments: (n.attachments ?? []).filter((a) => a.id !== id) } : n)) }));
    toast("Attachment removed", "warn");
  };
  const onMediaFile = async (f: File | undefined, kind: "image" | "video") => {
    if (!f) return;
    if (f.size > MAX_ATTACH) return toast("Keep attachments under 3 MB — this stays in local encrypted storage", "err");
    const dataUrl = await fileToDataUrl(f);
    pushAttachment({ id: uid(), kind, name: f.name, dataUrl, size: f.size, createdAt: Date.now() });
  };
  const startRecording = async () => {
    if (recRef.current) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return toast("Audio recording is not supported in this browser", "err");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size > MAX_ATTACH) return toast("Recording too long — keep it under 3 MB", "err");
        const dataUrl = await fileToDataUrl(new File([blob], "recording.webm", { type: blob.type }));
        pushAttachment({ id: uid(), kind: "audio", name: `Voice note · ${fmtClock(Date.now())}`, dataUrl, size: blob.size, createdAt: Date.now() });
      };
      recRef.current = rec;
      setRecSec(0);
      recTimer.current = window.setInterval(() => setRecSec((s) => (s === null ? s : s + 1)), 1000);
      rec.start();
      toast("Recording… speak your note", "ok");
    } catch {
      toast("Microphone permission denied", "err");
    }
  };
  const stopRecording = (save = true) => {
    const rec = recRef.current;
    if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; }
    setRecSec(null);
    recRef.current = null;
    if (rec && rec.state !== "inactive") {
      if (save) rec.stop();
      else rec.onstop = null;
    }
  };

  /* ---------------- editor (inline + pop-out) ---------------- */
  const mdBtn = (title: string, icon: React.ReactNode, fn: () => void) => (
    <button key={title} title={title} onClick={fn} disabled={preview === "preview" || !selNote}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:scale-105 disabled:opacity-35"
      style={{ color: "var(--mut)", cursor: "pointer", background: "var(--bg)", border: "1px solid var(--line)" }}>
      {icon}
    </button>
  );
  const wrap = (b: string, a: string) => { if (taRef.current) applyWrap(taRef.current, b, a, (v) => { setDraft((d) => ({ ...d, text: v })); dirty.current = true; }); };
  const prefix = (p: string) => { if (taRef.current) applyLinePrefix(taRef.current, p, (v) => { setDraft((d) => ({ ...d, text: v })); dirty.current = true; }); };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1">
      {mdBtn("Heading 1", <Heading1 size={13} />, () => prefix("# "))}
      {mdBtn("Heading 2", <Heading2 size={13} />, () => prefix("## "))}
      {mdBtn("Bold", <Bold size={13} />, () => wrap("**", "**"))}
      {mdBtn("Italic", <Italic size={13} />, () => wrap("*", "*"))}
      {mdBtn("Underline", <Underline size={13} />, () => wrap("++", "++"))}
      {mdBtn("Strikethrough", <Strikethrough size={13} />, () => wrap("~~", "~~"))}
      {mdBtn("Highlight", <Highlighter size={13} />, () => wrap("==", "=="))}
      {mdBtn("Inline code", <span className="font-mono text-[11px] font-bold">{"</>"}</span>, () => wrap("`", "`"))}
      {mdBtn("Quote", <Quote size={13} />, () => prefix("> "))}
      {mdBtn("Bullet list", <List size={13} />, () => prefix("- "))}
      {mdBtn("Numbered list", <ListOrdered size={13} />, () => prefix("1. "))}
      {mdBtn("Checklist", <ListTodo size={13} />, () => prefix("- [ ] "))}
      {mdBtn("Link", <Link2 size={13} />, () => wrap("[", "](https://)"))}
      {mdBtn("Divider", <Minus size={13} />, () => { setDraft((d) => ({ ...d, text: `${d.text}\n---\n` })); dirty.current = true; })}
      <span className="mx-1 h-5 w-px" style={{ background: "var(--line)" }} />
      <Seg size="sm" options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }]} value={preview} onChange={setPreview} />
    </div>
  );

  const attachmentsBar = (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-[1.03]"
        style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--mut)" }}>
        <ImageIcon size={12} /> Photo
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { onMediaFile(e.target.files?.[0], "image"); e.target.value = ""; }} />
      </label>
      <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-[1.03]"
        style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--mut)" }}>
        <Film size={12} /> Video
        <input type="file" accept="video/*" className="hidden" onChange={(e) => { onMediaFile(e.target.files?.[0], "video"); e.target.value = ""; }} />
      </label>
      {recSec === null ? (
        <button onClick={startRecording} className="flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-[1.03]"
          style={{ borderColor: "var(--line)", background: "var(--bg)", color: "var(--mut)", cursor: "pointer" }}>
          <Mic size={12} /> Record audio
        </button>
      ) : (
        <button onClick={() => stopRecording(true)} className="ring-pulse flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-bold"
          style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", cursor: "pointer" }}>
          <Square size={11} /> Stop · {recSec}s
        </button>
      )}
      <span className="text-[10px] font-semibold" style={{ color: "var(--mut)" }}>max 3 MB each · stored encrypted</span>
    </div>
  );

  const attachmentTiles = selNote && (selNote.attachments?.length ?? 0) > 0 && (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {selNote!.attachments!.map((a) => (
        <div key={a.id} className="attach-tile group relative aspect-square">
          {a.kind === "image" ? (
            <button onClick={() => setLightbox(a)} className="h-full w-full cursor-zoom-in" style={{ cursor: "zoom-in" }}>
              <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
            </button>
          ) : (
            <button onClick={() => setLightbox(a)} className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center" style={{ cursor: "pointer" }}>
              {a.kind === "video" ? <Film size={20} style={{ color: "var(--accent)" }} /> : <Mic size={20} style={{ color: "var(--accent)" }} />}
              <span className="w-full truncate text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>{a.name}</span>
            </button>
          )}
          <button onClick={() => removeAttachment(a.id)}
            className="absolute right-1 top-1 hidden rounded-md p-1 group-hover:block"
            style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", color: "var(--danger)", cursor: "pointer" }} title="Remove">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
    </div>
  );

  const editor = (popout: boolean) => (
    <div className={cn("flex min-h-0 flex-1 flex-col", popout && "h-full")}>
      {!selNote ? (
        <EmptyState icon={Lock} title="Select a note" body="Pick one from the list, or create a new note. Everything is encrypted before it touches storage." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={cn("inp min-w-0 flex-1 border-0 bg-transparent font-display font-bold !shadow-none focus:!border-0 focus:!shadow-none", popout ? "text-[26px]" : "text-[20px]")}
              value={draft.title}
              onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); dirty.current = true; }}
              placeholder="Note title"
            />
            <button onClick={() => togglePinNote(selNote)} title={selNote.pinned ? "Unpin" : "Pin to top"}
              className="rounded-lg p-1.5 transition-all hover:scale-110" style={{ color: selNote.pinned ? "var(--accent)" : "var(--mut)", cursor: "pointer" }}>
              {selNote.pinned ? <Pin size={15} fill="var(--accent)" /> : <Pin size={15} />}
            </button>
            <span className="chip shrink-0 text-[10px]" style={{ color: "var(--accent)" }}><Lock size={10} /> AES-256</span>
            <span className="chip shrink-0 text-[10px]" style={{ color: saveState === "saving" ? "var(--warn)" : "var(--ok)" }}>
              {saveState === "saving" ? "encrypting…" : "🔒 saved"}
            </span>
            <button onClick={() => setPopped((v) => !v)} title={popout ? "Back to normal view" : "Pop out to full screen"}
              className="rounded-lg p-1.5 transition-all hover:scale-110" style={{ color: "var(--mut)", cursor: "pointer" }}>
              {popout ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
          <div className="mt-1 text-[11px] font-semibold" style={{ color: "var(--mut)" }}>
            {selNote.daily && selNote.day ? `Daily note · ${fmtDayShort(selNote.day)} · ` : `${state.folders.find((f) => f.id === selNote.folderId)?.name ?? ""} · `}
            markdown supported · autosaves as you type
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {toolbar}
            {attachmentsBar}
          </div>

          {preview === "write" ? (
            <textarea
              ref={taRef}
              className={cn("note-page inp mt-3 min-h-0 flex-1 resize-none border-0 !bg-transparent !shadow-none", popout && "mx-auto w-full max-w-[760px]")}
              value={draft.text}
              onChange={(e) => { setDraft((d) => ({ ...d, text: e.target.value })); dirty.current = true; }}
              placeholder={selNote.daily ? "# Intentions\n- [ ] Finish hero wireframe\n\n# Log\n==Highlight== what mattered…" : "# Write freely\n**Bold**, *italic*, ++underline++, ==highlight==, lists, quotes…"}
            />
          ) : (
            <div className={cn("note-page mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border p-4", popout && "mx-auto w-full max-w-[760px]")}
              style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 55%, var(--panel))" }}>
              {draft.text.trim() ? renderMarkdown(draft.text) : <div style={{ color: "var(--mut)" }}>Nothing to preview yet — switch to Write and start typing.</div>}
            </div>
          )}

          {attachmentTiles}
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[500px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Notes</h1>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--mut)" }}>
            <Lock size={12} /> Second brain — markdown, media and voice, all encrypted at rest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search titles…" width={200} />
          <Btn variant="primary" onClick={createNote}><Plus size={13} /> Note</Btn>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[196px_280px_1fr]">
        {/* folders */}
        <div className="card engine-panel flex flex-col gap-1 overflow-y-auto p-2.5">
          {[{ id: "all", name: "All notes", emoji: "🗂️", pinned: false }, ...folders.map((f) => ({ id: f.id, name: f.name, emoji: f.id === "f-daily" ? "📅" : "📁", pinned: !!f.pinned }))].map((f) => {
            const count = f.id === "all" ? state.notes.length : state.notes.filter((n) => n.folderId === f.id).length;
            return (
              <div key={f.id} className="group flex items-center">
                <button
                  onClick={() => setFolderSel(f.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-bold transition-all"
                  style={folderSel === f.id ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--mut)", cursor: "pointer" }}
                >
                  <span>{f.pinned ? "📌" : f.emoji}</span>
                  <span className="truncate">{f.name}</span>
                  <span className="tnum ml-auto text-[10.5px]" style={{ color: "var(--mut)" }}>{count}</span>
                </button>
                {f.id !== "all" && (
                  <span className="mr-1 hidden items-center gap-0.5 group-hover:flex">
                    <button onClick={() => togglePinFolder(f.id, f.pinned)} className="rounded p-0.5" style={{ color: f.pinned ? "var(--accent)" : "var(--mut)", cursor: "pointer" }} title={f.pinned ? "Unpin folder" : "Pin folder"}>
                      {f.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                    </button>
                    {f.id !== "f-daily" && (
                      <button onClick={() => deleteFolder(f.id)} className="rounded p-0.5" style={{ color: "var(--mut)", cursor: "pointer" }} title="Delete folder">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {showNewFolder ? (
            <div className="mt-1 flex gap-1">
              <TextInput autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFolder()} placeholder="Folder name" />
            </div>
          ) : (
            <button onClick={() => setShowNewFolder(true)} className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-bold" style={{ color: "var(--mut)", cursor: "pointer" }}>
              <FolderPlus size={13} /> New folder
            </button>
          )}
          <div className="mt-2 rounded-xl border p-2 text-[10px] font-semibold leading-relaxed" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
            <Paperclip size={10} className="mr-1 inline" /> Attach photos, video clips and voice notes — they live inside the encrypted vault.
          </div>
        </div>

        {/* list */}
        <div className="card engine-panel flex min-h-0 flex-col p-2.5">
          <div className="flex-1 overflow-y-auto pr-1">
            {notes.length === 0 && <EmptyState icon={Lock} title="No notes here" body="Create a note or open today’s daily note." />}
            {notes.map((n) => (
              <div key={n.id} className="group mb-1 flex items-center">
                <button
                  onClick={() => { loadedFor.current = null; setSelId(n.id); }}
                  className="min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-left transition-all"
                  style={selId === n.id ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : { borderColor: "transparent", cursor: "pointer" }}
                >
                  <div className="flex items-center gap-1.5">
                    {n.pinned && <Pin size={11} fill="var(--accent)" style={{ color: "var(--accent)" }} />}
                    {n.daily && <span className="text-[12px]">📅</span>}
                    <span className="truncate text-[12.5px] font-bold">{n.title}</span>
                    {(n.attachments?.length ?? 0) > 0 && <Paperclip size={10} style={{ color: "var(--mut)" }} />}
                    <Lock size={10} className="ml-auto shrink-0" style={{ color: "var(--mut)" }} />
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-semibold tnum" style={{ color: "var(--mut)" }}>
                    {n.daily && n.day ? fmtDayShort(n.day) : state.folders.find((f) => f.id === n.folderId)?.name} · edited {fmtDayShort(isoOf(n.updatedAt))} {fmtClock(n.updatedAt)}
                  </div>
                </button>
                <span className="ml-1 hidden shrink-0 flex-col group-hover:flex">
                  <button onClick={() => togglePinNote(n)} style={{ color: n.pinned ? "var(--accent)" : "var(--mut)", cursor: "pointer" }} title="Pin">
                    {n.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  <button onClick={() => deleteNote(n)} style={{ color: "var(--mut)", cursor: "pointer" }} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* page editor */}
        <div className="card engine-panel flex min-h-0 flex-col p-5">{editor(false)}</div>
      </div>

      {/* pop-out editor */}
      <Modal open={popped} onClose={() => setPopped(false)} title={selNote?.title ?? "Note"} width={1080}>
        <div className="h-[74vh]">{editor(true)}</div>
      </Modal>

      {/* media viewer */}
      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title={lightbox?.name ?? ""} width={lightbox?.kind === "image" ? 900 : 620}>
        {lightbox?.kind === "image" && <img src={lightbox.dataUrl} alt={lightbox.name} className="mx-auto max-h-[72vh] rounded-xl" />}
        {lightbox?.kind === "video" && <video src={lightbox.dataUrl} controls className="mx-auto max-h-[72vh] w-full rounded-xl" />}
        {lightbox?.kind === "audio" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Mic size={40} style={{ color: "var(--accent)" }} />
            <audio src={lightbox.dataUrl} controls className="w-full max-w-[440px]" />
          </div>
        )}
      </Modal>
    </div>
  );
}

function isoOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
