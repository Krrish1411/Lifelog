import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, CheckSquare, ChevronDown, ChevronRight, Film, Folder, FolderOpen, FolderPlus, Heading1, Heading2,
  Highlighter, ImageIcon, Italic, Link2, List, ListOrdered, ListTodo,
  Lock, Maximize2, Mic, Minimize2, Minus, PanelLeft,
  Paperclip, Pencil, Pin, PinOff, Plus, Quote, Square, Strikethrough,
  Trash2, Underline, X, Loader2, BookOpen, Clock, FileText
} from "lucide-react";
import type { Attachment, Note } from "../types";
import { useApp } from "../store";
import { decryptText, encryptText, getDeviceKey } from "../utils/crypto";
import { fmtClock, fmtDayShort, fmtNoteName, todayIso, uid, extractWikiLinks } from "../utils/core";
import { applyLinePrefix, applyWrap, renderMarkdown } from "../utils/markdown";
import { consumeDailyNote } from "../utils/nav";
import { useBodyScrollLock } from "../utils/scrollLock";
import { Btn, EmptyState, Modal, SearchInput, Seg, Select, TextInput, cn } from "../components/ui";

interface Draft { title: string; text: string }
const MAX_ATTACH = 50 * 1024 * 1024; // 50 MB per attachment

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function NotesView() {
  const { state, set, toast, confirm, openTaskDialog } = useApp();
  const today = todayIso();
  const [folderSel, setFolderSel] = useState<string>("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>({ title: "", text: "" });
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("lifelog.notes.expandedFolders");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { "f-daily": true };
  });

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = { ...prev, [folderId]: !prev[folderId] };
      try {
        localStorage.setItem("lifelog.notes.expandedFolders", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useBodyScrollLock(drawerOpen);
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

  /* ensure today's daily note draft + cross-view request */
  const draftDailyId = `draft-daily-${today}`;

  useEffect(() => {
    const requested = consumeDailyNote();
    const targetIso = requested ?? today;
    const existing = state.notes.find((n) => n.daily && n.day === targetIso);
    if (existing) {
      setSelId(existing.id);
    } else if (requested) {
      setSelId(`draft-daily-${requested}`);
    } else {
      setSelId(draftDailyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => setDrawerOpen(true);
    window.addEventListener("lifelog:open-notes-drawer", handler);
    return () => window.removeEventListener("lifelog:open-notes-drawer", handler);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const noteId = e.detail?.noteId;
      if (noteId) {
        setFolderSel("all");
        setSelId(noteId);
      }
    };
    window.addEventListener("lifelog:open-note", handler);
    return () => window.removeEventListener("lifelog:open-note", handler);
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selIdRef = useRef(selId);
  selIdRef.current = selId;

  const flushSave = async () => {
    const curId = selIdRef.current;
    if (!curId || !dirty.current) return;
    const curDraft = draftRef.current;
    const isBlank = !curDraft.text.trim() && (!curDraft.title.trim() || curDraft.title === fmtNoteName(today));
    if (isBlank) {
      dirty.current = false;
      return;
    }
    dirty.current = false;
    try {
      const key = await getDeviceKey();
      const blob = await encryptText(key, curDraft.text);
      if (curId.startsWith("draft-daily-")) {
        const dayIso = curId.replace("draft-daily-", "") || today;
        const newId = uid();
        const newNote: Note = {
          id: newId,
          title: curDraft.title.trim() || fmtNoteName(dayIso),
          folderId: "f-daily",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          blob,
          daily: true,
          day: dayIso,
        };
        set((s) => ({ ...s, notes: [newNote, ...s.notes] }));
        selIdRef.current = newId;
        loadedFor.current = newId;
        setSelId(newId);
      } else {
        set((s) => ({
          ...s,
          notes: s.notes.map((n) => (n.id === curId ? { ...n, title: curDraft.title.trim() || n.title, blob, updatedAt: Date.now() } : n)),
        }));
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      // ignore
    }
  };

  /* flush pending save on unmount */
  useEffect(() => () => { flushSave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* load + decrypt selected note (only when switching notes!) */
  const prevSelId = useRef<string | null>(null);
  const lastLoadedUpdatedAt = useRef<number>(0);
  useEffect(() => {
    if (prevSelId.current && prevSelId.current !== selId && dirty.current) {
      flushSave();
    }
    const isSwitching = prevSelId.current !== selId;
    prevSelId.current = selId;

    if (!selId) return;
    if (isSwitching && taRef.current) {
      taRef.current.scrollTop = 0;
    }

    const note = selId && !selId.startsWith("draft-daily-") ? state.notes.find((n) => n.id === selId) : null;
    const isRemoteUpdate = !dirty.current && note && note.updatedAt > (lastLoadedUpdatedAt.current || 0);

    if (isSwitching || loadedFor.current !== selId || isRemoteUpdate) {
      if (selId.startsWith("draft-daily-")) {
        const dayIso = selId.replace("draft-daily-", "") || today;
        loadedFor.current = selId;
        dirty.current = false;
        setDraft({ title: fmtNoteName(dayIso), text: "" });
        return;
      }
      if (!note) return;
      loadedFor.current = selId;
      lastLoadedUpdatedAt.current = note.updatedAt;
      dirty.current = false;
      setDraft({ title: note.title, text: "" });
      getDeviceKey().then((k) => decryptText(k, note.blob)).then((text) => {
        setDraft((d) => (loadedFor.current === selId ? { ...d, text } : d));
      });
    }
  }, [selId, state.notes]);

  /* autosave (debounced, re-encrypts) */
  useEffect(() => {
    if (!selId || loadedFor.current !== selId || !dirty.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      await flushSave();
    }, 700);
    return () => clearTimeout(t);
  }, [draft.title, draft.text, selId]);

  /* stop recording on unmount */
  useEffect(() => () => { stopRecording(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const notes = useMemo(() => {
    let list = state.notes;
    if (folderSel !== "all") list = list.filter((n) => n.folderId === folderSel);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((n) => n.title.toLowerCase().includes(q));
    const sorted = [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
    if (selId?.startsWith("draft-daily-") && (folderSel === "all" || folderSel === "f-daily")) {
      const dayIso = selId.replace("draft-daily-", "") || today;
      const draftNote: Note = {
        id: selId,
        title: draft.title || fmtNoteName(dayIso),
        folderId: "f-daily",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blob: { plain: "" },
        daily: true,
        day: dayIso,
      };
      return [draftNote, ...sorted];
    }
    return sorted;
  }, [state.notes, folderSel, query, selId, draft.title, today]);

  const selNote = useMemo(() => {
    if (!selId) return undefined;
    if (selId.startsWith("draft-daily-")) {
      const dayIso = selId.replace("draft-daily-", "") || today;
      return {
        id: selId,
        title: draft.title || fmtNoteName(dayIso),
        folderId: "f-daily",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blob: { plain: "" },
        daily: true,
        day: dayIso,
      } as Note;
    }
    return state.notes.find((n) => n.id === selId);
  }, [selId, draft.title, state.notes, today]);
  const selFolder = state.folders.find((f) => f.id === selNote?.folderId);
  const currentFolderName = folderSel === "all" ? "All Notes" : (state.folders.find((f) => f.id === folderSel)?.name ?? "Folder");

  const linkedTasks = useMemo(
    () => state.tasks.filter((t) => t.linkedNoteIds?.includes(selId ?? "")),
    [state.tasks, selId]
  );
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
    setDrawerOpen(false);
    toast("Note created — encrypted as you type", "ok");
  };

  const deleteNote = async (n: Note) => {
    const ok = await confirm({
      title: "Delete note",
      body: `“${n.title || "Untitled note"}” and its ${n.attachments?.length ?? 0} attachment(s) will be permanently deleted.`,
      confirmLabel: "Delete note",
      danger: true,
      compact: true,
    });
    if (!ok) return;
    set((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== n.id) }));
    if (selId === n.id) {
      const remaining = state.notes.filter((x) => x.id !== n.id);
      setSelId(remaining[0]?.id ?? null);
      loadedFor.current = null;
    }
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

  const saveFolderEdit = () => {
    if (!editingFolder) return;
    const name = editingFolder.name.trim();
    if (!name) {
      toast("Folder name cannot be empty", "err");
      return;
    }
    set((s) => ({
      ...s,
      folders: s.folders.map((f) => (f.id === editingFolder.id ? { ...f, name } : f)),
    }));
    setEditingFolder(null);
    toast("Folder renamed", "ok");
  };

  const deleteFolder = async (id: string) => {
    const f = state.folders.find((x) => x.id === id);
    const count = state.notes.filter((n) => n.folderId === id).length;
    const body =
      count > 0
        ? `Delete folder “${f?.name ?? "Folder"}”? Its ${count} note(s) will be kept in All Notes.`
        : `Delete empty folder “${f?.name ?? "Folder"}”?`;
    const ok = await confirm({
      title: "Delete folder",
      body,
      confirmLabel: "Delete folder",
      danger: true,
      compact: true,
    });
    if (!ok) return;
    set((s) => ({
      ...s,
      folders: s.folders.filter((item) => item.id !== id),
      notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: "f-daily" } : n)),
    }));
    if (folderSel === id) setFolderSel("all");
    toast("Folder deleted", "warn");
  };

  /* ---------------- attachments ---------------- */
  const pushAttachment = (a: Attachment) => {
    if (!selId) return;
    set((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === selId ? { ...n, attachments: [...(n.attachments ?? []), a], updatedAt: Date.now() } : n)),
    }));
    toast(`${a.kind === "image" ? "Photo" : a.kind === "video" ? "Video" : "Audio"} attached — encrypted with note`, "ok");
  };

  const removeAttachment = (id: string) => {
    if (!selId) return;
    set((s) => ({ ...s, notes: s.notes.map((n) => (n.id === selId ? { ...n, attachments: (n.attachments ?? []).filter((a) => a.id !== id) } : n)) }));
    toast("Attachment removed", "warn");
  };

  const onMediaFile = async (f: File | undefined, kind: "image" | "video") => {
    if (!f) return;
    if (f.size > MAX_ATTACH) return toast("Attachment exceeds 50 MB limit", "err");
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
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size > MAX_ATTACH) return toast("Recording exceeds 50 MB limit", "err");
        const dataUrl = await fileToDataUrl(new File([blob], "recording.webm", { type: blob.type }));
        pushAttachment({ id: uid(), kind: "audio", name: `Voice note · ${fmtClock(Date.now())}`, dataUrl, size: blob.size, createdAt: Date.now() });
      };
      recRef.current = rec;
      setRecSec(0);
      recTimer.current = window.setInterval(() => setRecSec((s) => (s === null ? s : s + 1)), 1000);
      rec.start(250);
      toast("Recording… speak your note", "ok");
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      console.error("Audio recording error:", err);
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError" || error?.message?.includes("Permission")) {
        toast("Microphone permission denied. Please allow microphone access in Android settings.", "err");
      } else {
        toast("Microphone unavailable or permission denied", "err");
      }
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

  /* ---------------- editor actions ---------------- */
  const mdBtn = (title: string, icon: React.ReactNode, fn: () => void) => (
    <button
      key={title}
      title={title}
      onClick={fn}
      disabled={preview === "preview" || !selNote}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:scale-105 active:scale-95 disabled:opacity-30 cursor-pointer text-[var(--mut)]"
    >
      {icon}
    </button>
  );
  const wrap = (b: string, a: string) => { if (taRef.current) applyWrap(taRef.current, b, a, (v) => { setDraft((d) => ({ ...d, text: v })); dirty.current = true; }); };
  const prefix = (p: string) => { if (taRef.current) applyLinePrefix(taRef.current, p, (v) => { setDraft((d) => ({ ...d, text: v })); dirty.current = true; }); };

  const formattingToolbar = (
    <div className="flex items-center gap-1.5 w-full min-w-0 overflow-x-auto scrollbar-none py-1 px-1 select-none">
      {/* Group 1: Typography */}
      <div className="flex items-center gap-0.5 shrink-0">
        {mdBtn("Heading 1", <Heading1 size={13} />, () => prefix("# "))}
        {mdBtn("Heading 2", <Heading2 size={13} />, () => prefix("## "))}
      </div>

      <div className="w-px h-4 shrink-0 bg-[var(--line)] mx-0.5" />

      {/* Group 2: Inline Styles */}
      <div className="flex items-center gap-0.5 shrink-0">
        {mdBtn("Bold", <Bold size={13} />, () => wrap("**", "**"))}
        {mdBtn("Italic", <Italic size={13} />, () => wrap("*", "*"))}
        {mdBtn("Underline", <Underline size={13} />, () => wrap("++", "++"))}
        {mdBtn("Strikethrough", <Strikethrough size={13} />, () => wrap("~~", "~~"))}
        {mdBtn("Highlight", <Highlighter size={13} />, () => wrap("==", "=="))}
        {mdBtn("Inline code", <span className="font-mono text-[11px] font-bold">{"</>"}</span>, () => wrap("`", "`"))}
        {mdBtn("Quote", <Quote size={13} />, () => prefix("> "))}
      </div>

      <div className="w-px h-4 shrink-0 bg-[var(--line)] mx-0.5" />

      {/* Group 3: Structure */}
      <div className="flex items-center gap-0.5 shrink-0">
        {mdBtn("Bullet list", <List size={13} />, () => prefix("- "))}
        {mdBtn("Numbered list", <ListOrdered size={13} />, () => prefix("1. "))}
        {mdBtn("Checklist", <ListTodo size={13} />, () => prefix("- [ ] "))}
        {mdBtn("Link", <Link2 size={13} />, () => wrap("[", "](https://)"))}
        {mdBtn("Divider", <Minus size={13} />, () => { setDraft((d) => ({ ...d, text: `${d.text}\n---\n` })); dirty.current = true; })}
      </div>

      <div className="w-px h-4 shrink-0 bg-[var(--line)] mx-0.5" />

      {/* Group 4: Media Attachments */}
      <div className="flex items-center gap-1.5 shrink-0">
        <label
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: "var(--line)", background: "var(--panel2)", color: "var(--mut)" }}
          title="Attach photo"
        >
          <ImageIcon size={12} />
          <span className="hidden sm:inline">Photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { onMediaFile(e.target.files?.[0], "image"); e.target.value = ""; }} />
        </label>
        <label
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: "var(--line)", background: "var(--panel2)", color: "var(--mut)" }}
          title="Attach video"
        >
          <Film size={12} />
          <span className="hidden sm:inline">Video</span>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { onMediaFile(e.target.files?.[0], "video"); e.target.value = ""; }} />
        </label>
        {recSec === null ? (
          <button
            onClick={startRecording}
            className="flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
            style={{ borderColor: "var(--line)", background: "var(--panel2)", color: "var(--mut)" }}
            title="Record audio snippet"
          >
            <Mic size={12} />
            <span className="hidden sm:inline">Record</span>
          </button>
        ) : (
          <button
            onClick={() => stopRecording(true)}
            className="ring-pulse flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold cursor-pointer"
            style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)" }}
          >
            <Square size={10} /> {recSec}s
          </button>
        )}
      </div>

      {/* Group 5: Security Indicator */}
      <div
        className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-500 shrink-0 ml-auto pl-2"
        title="Notes & attachments are client-side encrypted with AES-256 GCM before saving."
      >
        <Lock size={12} />
        <span className="hidden md:inline">AES-256</span>
      </div>
    </div>
  );

  const attachmentTiles = selNote && (selNote.attachments?.length ?? 0) > 0 && (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 shrink-0">
      {selNote!.attachments!.map((a) => (
        <div key={a.id} className="attach-tile group relative aspect-square">
          {a.kind === "image" ? (
            <button onClick={() => setLightbox(a)} className="h-full w-full cursor-zoom-in" style={{ cursor: "zoom-in" }}>
              <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover rounded-lg" />
            </button>
          ) : (
            <button onClick={() => setLightbox(a)} className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center rounded-lg border" style={{ cursor: "pointer", borderColor: "var(--line)" }}>
              {a.kind === "video" ? <Film size={20} style={{ color: "var(--accent)" }} /> : <Mic size={20} style={{ color: "var(--accent)" }} />}
              <span className="w-full truncate text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>{a.name}</span>
            </button>
          )}
          <button onClick={() => removeAttachment(a.id)}
            className="absolute right-1 top-1 hidden rounded-md p-1 group-hover:block shadow-sm"
            style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)", color: "var(--danger)", cursor: "pointer" }} title="Remove">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
    </div>
  );

  const createNoteInFolder = (folderId: string) => {
    const id = uid();
    const actualFolder = folderId === "all" ? (state.folders.find((f) => f.id !== "f-daily")?.id ?? "f-daily") : folderId;
    set((s) => ({
      ...s,
      notes: [
        {
          id,
          title: "Untitled note",
          folderId: actualFolder,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          blob: { plain: "" },
          daily: false,
          day: null,
        },
        ...s.notes,
      ],
    }));
    setExpandedFolders((prev) => ({ ...prev, [actualFolder]: true }));
    loadedFor.current = null;
    setSelId(id);
    setDrawerOpen(false);
    toast("Note created — encrypted as you type", "ok");
  };

  const renderNoteItem = (n: Note, isNested: boolean) => {
    const isSelected = selId === n.id;
    return (
      <div key={n.id} className="group/note relative flex items-center">
        <button
          onClick={() => {
            loadedFor.current = null;
            setSelId(n.id);
            setDrawerOpen(false);
          }}
          className={cn(
            "min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left transition-all cursor-pointer flex items-center justify-between gap-1.5",
            isSelected
              ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold shadow-2xs border border-[var(--accent)]/30"
              : "text-[var(--text)] hover:bg-[var(--panel2)] border border-transparent font-medium"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {n.pinned ? (
              <Pin size={11} className="text-[var(--accent)] shrink-0" fill="currentColor" />
            ) : n.daily ? (
              <span className="text-[12px] shrink-0">📅</span>
            ) : (
              <FileText size={12} className={isSelected ? "text-[var(--accent)] shrink-0" : "text-[var(--mut)] shrink-0"} />
            )}
            <span className="truncate text-[12.5px]">
              {n.title || "Untitled note"}
            </span>
            {(n.attachments?.length ?? 0) > 0 && (
              <Paperclip size={10} className="text-[var(--mut)] shrink-0" />
            )}
          </div>
          <span className="text-[10px] text-[var(--mut)] shrink-0 tnum ml-1">
            {fmtDayShort(isoOf(n.updatedAt))}
          </span>
        </button>

        {/* Note quick actions on hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/note:flex items-center gap-0.5 bg-[var(--panel)] rounded-md p-0.5 shadow-sm border border-[var(--line)]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePinNote(n); }}
            className="p-1 text-[var(--mut)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            title={n.pinned ? "Unpin note" : "Pin note"}
          >
            {n.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteNote(n); }}
            className="p-1 text-[var(--mut)] hover:text-[var(--danger)] transition-colors cursor-pointer"
            title="Delete note"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  };

  /* ---------------- Unified Folder & Notes Tree Content ---------------- */
  const sidebarTreeContent = (
    <div className="flex min-h-0 flex-1 flex-col p-2.5 w-full min-w-0 overflow-hidden">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>
          Folders & Notes
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors cursor-pointer p-0.5"
            title="New folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={createNote}
            className="flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
            title="New note"
          >
            <Plus size={13} /> Note
          </button>
        </div>
      </div>

      {/* Inline New Folder creation input */}
      {showNewFolder && (
        <div className="mb-2 px-1 flex gap-1 items-center">
          <TextInput
            autoFocus
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addFolder();
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolder(""); }
            }}
            placeholder="Folder name…"
            className="text-xs !py-1"
          />
          <Btn size="sm" variant="primary" onClick={addFolder} className="!py-1 !px-2 shrink-0">Add</Btn>
          <button onClick={() => { setShowNewFolder(false); setNewFolder(""); }} className="p-1 text-[var(--mut)] hover:text-[var(--text)] cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tree scroll area */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-1">
        {/* If user searched query, show flat search matches */}
        {query.trim() ? (
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--mut)] px-2 py-1">
              Search Results ({notes.length})
            </div>
            {notes.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--mut)]">No notes matching “{query}”</div>
            ) : (
              notes.map((n) => renderNoteItem(n, false))
            )}
          </div>
        ) : (
          <>
            {/* All Notes Root Option */}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-bold transition-colors cursor-pointer hover:bg-[var(--panel2)]",
                folderSel === "all" ? "bg-[var(--panel2)] text-[var(--accent)]" : "text-[var(--text)]"
              )}
              onClick={() => setFolderSel("all")}
            >
              <span className="text-[13px]">🗂️</span>
              <span className="truncate flex-1">All notes</span>
              <span
                className="tnum text-[10.5px] px-1.5 py-0.2 rounded-full ml-auto shrink-0"
                style={{ background: "var(--panel)", color: "var(--mut)" }}
              >
                {state.notes.length}
              </span>
            </div>

            {/* Folders Accordion Nodes */}
            {folders.map((f) => {
              const isExpanded = !!expandedFolders[f.id];
              const folderNotes = state.notes
                .filter((n) => n.folderId === f.id)
                .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);

              const displayedNotes = (f.id === "f-daily" && selId?.startsWith("draft-daily-"))
                ? [
                    {
                      id: selId,
                      title: draft.title || fmtNoteName(selId.replace("draft-daily-", "") || today),
                      folderId: "f-daily",
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      blob: { plain: "" },
                      daily: true,
                      day: selId.replace("draft-daily-", "") || today,
                    } as Note,
                    ...folderNotes,
                  ]
                : folderNotes;

              return (
                <div key={f.id} className="flex flex-col group/folder select-none">
                  {/* Folder Header Row */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-bold transition-colors cursor-pointer hover:bg-[var(--panel2)]",
                      selFolder?.id === f.id ? "text-[var(--accent)]" : "text-[var(--text)]"
                    )}
                    onClick={() => {
                      setFolderSel(f.id);
                      toggleFolderExpand(f.id);
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleFolderExpand(f.id); }}
                      className="p-0.5 text-[var(--mut)] hover:text-[var(--text)] transition-transform"
                      aria-label="Toggle folder"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <span className="text-[13px]">{f.id === "f-daily" ? "📅" : isExpanded ? "📂" : "📁"}</span>
                    <span className="truncate flex-1">{f.name}</span>
                    <span
                      className="tnum text-[10.5px] px-1.5 py-0.2 rounded-full ml-auto shrink-0"
                      style={{ background: "var(--panel)", color: "var(--mut)" }}
                    >
                      {displayedNotes.length}
                    </span>

                    {/* Folder inline action buttons on hover */}
                    <div className="hidden group-hover/folder:flex items-center gap-0.5 shrink-0 ml-1">
                      {f.id !== "f-daily" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); createNoteInFolder(f.id); }}
                          className="rounded p-1 text-[var(--mut)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          title="New note in folder"
                        >
                          <Plus size={11} />
                        </button>
                      )}
                      {f.id !== "all" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); togglePinFolder(f.id, f.pinned); }}
                          className="rounded p-1 text-[var(--mut)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          style={{ color: f.pinned ? "var(--accent)" : undefined }}
                          title={f.pinned ? "Unpin folder" : "Pin folder"}
                        >
                          {f.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                        </button>
                      )}
                      {f.id !== "f-daily" && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: f.id, name: f.name }); }}
                            className="rounded p-1 text-[var(--mut)] hover:text-[var(--text)] transition-colors cursor-pointer"
                            title="Rename folder"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }}
                            className="rounded p-1 text-[var(--mut)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                            title="Delete folder"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes Inside Folder (Indented Tree Children) */}
                  {isExpanded && (
                    <div className="pl-3.5 ml-2 border-l border-[var(--line)] flex flex-col space-y-0.5 mt-0.5 mb-1">
                      {displayedNotes.length === 0 ? (
                        <div className="py-1 px-2 text-[11px] text-[var(--mut)] italic">
                          No notes in folder
                        </div>
                      ) : (
                        displayedNotes.map((n) => renderNoteItem(n, true))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  /* ---------------- Note Editor Canvas (Notion / Obsidian Style) ---------------- */
  const editor = (popout: boolean) => {
    const wordCount = draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0;
    const readingMin = Math.max(1, Math.ceil(wordCount / 200));
    const isDaily = selNote?.daily;
    const noteDate = selNote?.daily && selNote?.day
      ? `Daily Note · ${fmtDayShort(selNote.day)}`
      : selNote ? `${fmtDayShort(isoOf(selNote.updatedAt))} at ${fmtClock(selNote.updatedAt)}` : "";

    return (
      <div className={cn("flex min-h-0 flex-1 flex-col w-full min-w-0", popout && "h-full")}>
        {!selNote ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <EmptyState
              icon={Lock}
              title="No note selected"
              body="Open the sidebar to select an encrypted note or create a new one."
            />
            <div className="mt-4 flex gap-2">
              <Btn variant="outline" onClick={() => setDrawerOpen(true)}>
                <PanelLeft size={14} /> Open Folders & Notes
              </Btn>
              <Btn variant="primary" onClick={createNote}>
                <Plus size={14} /> New Note
              </Btn>
            </div>
          </div>
        ) : (
          <>
            {/* Top Toolbar inside note canvas */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--line)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Mobile Drawer trigger button */}
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex md:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel2)] hover:bg-[var(--panel)] transition-colors text-xs font-bold text-[var(--text)] shadow-xs shrink-0 cursor-pointer"
                  title="Open folders & notes list"
                >
                  <PanelLeft size={15} className="text-[var(--accent)] shrink-0" />
                  <span className="truncate max-w-[130px] font-bold">
                    {currentFolderName}
                  </span>
                  <span className="text-[10.5px] text-[var(--mut)] bg-[var(--bg)] px-1.5 py-0.2 rounded-full tnum shrink-0">
                    {notes.length}
                  </span>
                </button>

                {/* Desktop Folder Heading */}
                <div className="hidden md:flex items-center gap-2 text-xs font-bold text-[var(--text)]">
                  <span className="truncate max-w-[220px] font-bold text-sm">
                    {currentFolderName}
                  </span>
                  <span className="text-[10.5px] text-[var(--mut)] bg-[var(--panel2)] px-2 py-0.5 rounded-full tnum shrink-0">
                    {notes.length} {notes.length === 1 ? "note" : "notes"}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--mut)] font-semibold">
                  {saveState === "saving" ? (
                    <span className="text-[var(--warn)] flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Saving…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 opacity-70">
                      <Lock size={11} className="text-[var(--accent)]" /> Saved
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Seg
                  size="sm"
                  options={[
                    { value: "write", label: "Write" },
                    { value: "preview", label: "Preview" },
                  ]}
                  value={preview}
                  onChange={setPreview}
                />

                <button
                  onClick={() => togglePinNote(selNote)}
                  title={selNote.pinned ? "Unpin note" : "Pin note to top"}
                  className="rounded-lg p-1.5 transition-all hover:bg-[var(--panel2)] cursor-pointer shrink-0"
                  style={{ color: selNote.pinned ? "var(--accent)" : "var(--mut)" }}
                >
                  {selNote.pinned ? <Pin size={16} fill="var(--accent)" /> : <Pin size={16} />}
                </button>

                <button
                  onClick={() => setPopped((v) => !v)}
                  title={popout ? "Minimize" : "Full screen"}
                  className="rounded-lg p-1.5 transition-all hover:bg-[var(--panel2)] cursor-pointer text-[var(--mut)] shrink-0 hidden sm:inline-flex"
                >
                  {popout ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  onClick={() => deleteNote(selNote)}
                  title="Delete note"
                  className="rounded-lg p-1.5 transition-all hover:bg-[var(--panel2)] hover:text-[var(--danger)] cursor-pointer text-[var(--mut)] shrink-0"
                >
                  <Trash2 size={16} />
                </button>

                <Btn variant="primary" size="sm" onClick={createNote} className="shrink-0">
                  <Plus size={14} /> <span className="hidden sm:inline">Note</span>
                </Btn>
              </div>
            </div>

            {/* Document Canvas (Obsidian / Notion Page) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="w-full max-w-none flex flex-col min-h-full px-3 sm:px-6 md:px-8 lg:px-12 pt-4 pb-8">
                {/* Notion-style Page Icon */}
                <div className="text-3xl mb-1 select-none flex items-center gap-2">
                  <span>{isDaily ? "📅" : "📝"}</span>
                  {selNote.pinned && <span className="text-xs chip text-[var(--accent)] font-bold">Pinned</span>}
                </div>

                {/* Borderless Title */}
                <input
                  type="text"
                  autoCapitalize="sentences"
                  autoComplete="on"
                  autoCorrect="on"
                  spellCheck={true}
                  {...({ writingsuggestions: "true" } as any)}
                  value={draft.title}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, title: e.target.value }));
                    dirty.current = true;
                  }}
                  placeholder="Note title"
                  className={cn(
                    "w-full bg-transparent border-none outline-none font-extrabold font-display tracking-tight text-[var(--text)] placeholder:text-[var(--mut)]/30 p-0 focus:outline-none focus:ring-0 leading-tight",
                    popout ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
                  )}
                />

                {/* Obsidian-style Metadata Properties Bar */}
                <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[var(--mut)] flex-wrap pb-3 border-b border-[var(--line)]">
                  <Select
                    size="sm"
                    value={selNote.folderId}
                    onChange={(folderId) => {
                      if (selNote.id.startsWith("draft-daily-")) return;
                      set((s) => ({
                        ...s,
                        notes: s.notes.map((n) => (n.id === selNote.id ? { ...n, folderId, updatedAt: Date.now() } : n)),
                      }));
                      toast("Folder updated", "ok");
                    }}
                    options={state.folders.map((f) => ({
                      value: f.id,
                      label: f.name,
                      icon: <span>{f.id === "f-daily" ? "📅" : "📁"}</span>,
                    }))}
                  />
                  <span className="chip !py-0.5 text-[10.5px]">
                    📅 {noteDate}
                  </span>
                  <span className="chip !py-0.5 text-[10.5px]">
                    <BookOpen size={11} className="inline mr-1 opacity-70" />
                    {wordCount} words · {readingMin}m read
                  </span>
                  <span className="chip !py-0.5 text-[10.5px] text-[var(--accent)] font-semibold">
                    <Lock size={10} className="inline mr-1" /> AES-256
                  </span>
                  {saveState === "saving" && (
                    <span className="sm:hidden text-[var(--warn)] font-semibold flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Saving
                    </span>
                  )}
                </div>

                {/* Linked Tasks */}
                {linkedTasks.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-xs shrink-0">
                    <span className="font-bold text-blue-500 flex items-center gap-1 shrink-0">
                      <CheckSquare size={12} /> Linked Tasks ({linkedTasks.length}):
                    </span>
                    {linkedTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openTaskDialog({ taskId: t.id })}
                        className="chip text-[11px] !py-0.5 hover:border-accent cursor-pointer flex items-center gap-1 transition-all"
                        title="Click to view task"
                      >
                        <span>{t.emoji ?? "▸"}</span>
                        <span className={cn("font-medium", t.done && "line-through opacity-60")}>
                          {t.title}
                        </span>
                        {t.done && <span className="text-emerald-500 font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Note Body Textarea or Markdown View */}
                {preview === "write" ? (
                  <textarea
                    ref={taRef}
                    className="note-page flex-1 min-h-[320px] w-full resize-none border-0 !bg-transparent text-[15px] sm:text-[15.5px] leading-[1.75] text-[var(--text)] placeholder:text-[var(--mut)]/30 focus:outline-none focus:ring-0 !p-0 mt-4 pb-28"
                    autoCapitalize="sentences"
                    autoComplete="on"
                    autoCorrect="on"
                    spellCheck={true}
                    {...({ writingsuggestions: "true" } as any)}
                    value={draft.text}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, text: e.target.value }));
                      dirty.current = true;
                    }}
                    placeholder={
                      selNote.daily
                        ? "# Intentions\n- [ ] Finish hero wireframe\n\n# Log\n==Highlight== what mattered today…"
                        : "# Start writing freely\n**Bold**, *italic*, ==highlight==, checklists, lists…"
                    }
                  />
                ) : (
                  <div
                    className="note-page flex-1 min-h-[320px] w-full overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)]/40 p-5 mt-4 leading-relaxed pb-28"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const chip = target.closest<HTMLElement>("[data-wiki-type]");
                      if (!chip) return;
                      const wikiType = chip.getAttribute("data-wiki-type");
                      const wikiTarget = chip.getAttribute("data-wiki-target");
                      if (!wikiTarget) return;

                      if (wikiType === "note") {
                        const match = state.notes.find(
                          (n) => n.title.toLowerCase() === wikiTarget.toLowerCase() || n.day === wikiTarget
                        );
                        if (match) {
                          setFolderSel("all");
                          setSelId(match.id);
                          toast(`Opened note: ${match.title}`, "ok");
                        } else {
                          const newId = uid();
                          set((s) => ({
                            ...s,
                            notes: [
                              ...s.notes,
                              {
                                id: newId,
                                title: wikiTarget,
                                folderId: "f-inbox",
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                blob: { ciphertext: "", iv: "", salt: "" },
                                daily: false,
                                day: null,
                              },
                            ],
                          }));
                          setFolderSel("all");
                          setSelId(newId);
                          toast(`Created new note: ${wikiTarget}`, "ok");
                        }
                      } else if (wikiType === "task") {
                        const task = state.tasks.find(
                          (t) => t.title.toLowerCase().includes(wikiTarget.toLowerCase()) || t.id === wikiTarget
                        );
                        if (task) {
                          openTaskDialog({ taskId: task.id });
                        } else {
                          openTaskDialog({ initialTitle: wikiTarget });
                        }
                      } else if (wikiType === "project") {
                        const proj = state.projects.find(
                          (p) => p.name.toLowerCase() === wikiTarget.toLowerCase() || p.id === wikiTarget
                        );
                        if (proj) {
                          window.location.hash = "tasks";
                          window.dispatchEvent(new CustomEvent("lifelog:filter-project", { detail: { projectId: proj.id } }));
                          toast(`Switched to Project #${proj.name}`, "ok");
                        } else {
                          toast(`Project #${wikiTarget} not found`, "warn");
                        }
                      }
                    }}
                  >
                    {draft.text.trim() ? (
                      <>
                        {renderMarkdown(draft.text)}
                        {/* Bi-Directional Wiki Backlinks & References Tray */}
                        {(() => {
                          const links = extractWikiLinks(draft.text);
                          if (links.length === 0) return null;
                          return (
                            <div className="mt-8 pt-4 border-t border-[var(--line)] space-y-2 select-none">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--mut)] uppercase tracking-wider">
                                <Link2 size={13} className="text-[var(--accent)]" />
                                <span>Wiki References ({links.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {links.map((lnk, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    data-wiki-type={lnk.type}
                                    data-wiki-target={lnk.target}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all hover:scale-105 cursor-pointer"
                                    style={{
                                      background:
                                        lnk.type === "note"
                                          ? "var(--accent-soft)"
                                          : lnk.type === "task"
                                          ? "rgba(59, 130, 246, 0.12)"
                                          : "rgba(16, 185, 129, 0.12)",
                                      color:
                                        lnk.type === "note"
                                          ? "var(--accent)"
                                          : lnk.type === "task"
                                          ? "#3b82f6"
                                          : "#10b981",
                                      borderColor: "var(--line)",
                                    }}
                                  >
                                    {lnk.type === "note" ? "📄" : lnk.type === "task" ? "☑️" : "📁"} {lnk.raw}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div style={{ color: "var(--mut)" }}>Nothing to preview yet — switch to Write and start typing.</div>
                    )}
                  </div>
                )}

                {/* Attachment tiles */}
                {attachmentTiles}
              </div>
            </div>

            {/* Formatting & Media Toolbar */}
            <div className="border-t border-[var(--line)] w-full min-w-0 shrink-0 glass-regular rounded-b-2xl">
              {formattingToolbar}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-115px)] flex-col w-full max-w-full overflow-hidden">
      {/* Slide-over Drawer for Folders & Notes */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex overscroll-contain" role="dialog" aria-modal="true" aria-label="Folders and notes drawer">
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer content */}
          <aside
            className={cn(
              "relative z-10 flex h-full w-[310px] max-w-[86vw] flex-col border-r shadow-2xl transition-transform animate-in slide-in-from-left duration-250 select-none overscroll-contain",
              state.settings.layout === "glass" ? "glass-regular" : "bg-[var(--panel)]"
            )}
            style={{
              borderColor: "var(--line)",
              paddingTop: "max(calc(var(--safe-top) + 8px), 16px)",
              paddingBottom: "max(var(--safe-bottom), 16px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center gap-2">
                <PanelLeft size={18} style={{ color: "var(--accent)" }} />
                <span className="font-display text-[15px] font-bold tracking-tight">Folders & Notes</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[var(--mut)] hover:bg-[var(--panel2)] hover:text-[var(--text)] transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-3 pt-3 pb-1 shrink-0">
              <SearchInput value={query} onChange={setQuery} placeholder="Search notes…" />
            </div>

            {/* Unified Folders & Notes Tree in Drawer */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col overscroll-contain">
              {sidebarTreeContent}
            </div>
          </aside>
        </div>
      )}

      {/* Main Container Layout: Desktop Docked Sidebar + Canvas */}
      <div className="flex min-h-0 flex-1 w-full min-w-0 gap-3">
        {/* Desktop Docked Sidebar (>= md) */}
        <aside
          className={cn(
            "hidden md:flex md:w-[270px] lg:w-[310px] shrink-0 flex-col rounded-2xl select-none overflow-hidden",
            state.settings.layout === "glass" ? "glass-regular" : "bg-[var(--panel)] border border-[var(--line)]"
          )}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-[var(--line)] shrink-0">
            <SearchInput value={query} onChange={setQuery} placeholder="Search notes…" />
          </div>

          {/* Unified Folders & Notes Tree in Sidebar */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {sidebarTreeContent}
          </div>
        </aside>

        {/* Editor Canvas */}
        <div className="card engine-panel flex flex-1 min-h-0 flex-col p-3 sm:p-5 w-full min-w-0 overflow-hidden">
          {editor(false)}
        </div>
      </div>

      {/* Rename / Edit Folder Modal */}
      <Modal
        open={!!editingFolder}
        onClose={() => setEditingFolder(null)}
        title="Rename Folder"
        width={380}
        footer={
          <div className="flex items-center justify-between w-full">
            {editingFolder && editingFolder.id !== "f-daily" && (
              <Btn
                variant="danger"
                size="sm"
                onClick={() => {
                  const id = editingFolder.id;
                  setEditingFolder(null);
                  deleteFolder(id);
                }}
              >
                <Trash2 size={13} /> Delete
              </Btn>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Btn variant="ghost" size="sm" onClick={() => setEditingFolder(null)}>
                Cancel
              </Btn>
              <Btn variant="primary" size="sm" onClick={saveFolderEdit}>
                Save
              </Btn>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-2 py-1">
          <label className="text-xs font-bold text-[var(--mut)] uppercase tracking-wider">
            Folder Name
          </label>
          <TextInput
            autoFocus
            value={editingFolder?.name ?? ""}
            onChange={(e) => setEditingFolder((prev) => (prev ? { ...prev, name: e.target.value } : null))}
            onKeyDown={(e) => e.key === "Enter" && saveFolderEdit()}
            placeholder="Folder name"
          />
        </div>
      </Modal>

      {/* Pop-out fullscreen editor */}
      <Modal open={popped} onClose={() => setPopped(false)} title={selNote?.title ?? "Note"} width={1080}>
        <div className="h-[76vh] flex flex-col">{editor(true)}</div>
      </Modal>

      {/* Media lightbox viewer */}
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
