import { useState, useEffect, useRef, useCallback } from "react";
import { CheckSquare, Folder, Hash, ListTodo, FileText, Calendar } from "lucide-react";
import type { Task, Project, Note } from "../types";
import { cn } from "./ui";

export type MentionType = "task" | "project" | "note";

export interface MentionItem {
  id: string;
  type: MentionType;
  title: string;
  subtitle?: string;
  emoji?: string | null;
  color?: string;
  done?: boolean;
}

export interface MentionState {
  active: boolean;
  type: MentionType | null;
  query: string;
  triggerIndex: number;
  triggerChar: string;
}

interface MentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (newValue: string) => void;
  tasks: Task[];
  projects: Project[];
  notes: Note[];
}

export function MentionAutocomplete({
  textareaRef,
  value,
  onChange,
  tasks,
  projects,
  notes,
}: MentionAutocompleteProps) {
  const [mention, setMention] = useState<MentionState>({
    active: false,
    type: null,
    query: "",
    triggerIndex: -1,
    triggerChar: "",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scan text before cursor on input / cursor movement
  const checkMention = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const cursorPos = ta.selectionStart;
    if (cursorPos === null || cursorPos === undefined) return;

    const textBefore = value.slice(0, cursorPos);
    const lastLine = textBefore.split("\n").pop() ?? "";
    const lineOffset = cursorPos - lastLine.length;

    // Detect triggers:
    // [[ for notes or [ for notes
    // # for projects
    // @ for tasks
    let foundType: MentionType | null = null;
    let triggerChar = "";
    let triggerIdxInLine = -1;

    // Check [[ first, then [
    const doubleBracketIdx = lastLine.lastIndexOf("[[");
    const singleBracketIdx = lastLine.lastIndexOf("[");
    const hashIdx = lastLine.lastIndexOf("#");
    const atIdx = lastLine.lastIndexOf("@");

    const candidates = [
      { type: "note" as MentionType, char: "[[", idx: doubleBracketIdx },
      { type: "note" as MentionType, char: "[", idx: doubleBracketIdx === -1 ? singleBracketIdx : -1 },
      { type: "project" as MentionType, char: "#", idx: hashIdx },
      { type: "task" as MentionType, char: "@", idx: atIdx },
    ].filter((c) => c.idx !== -1);

    if (candidates.length > 0) {
      // Pick the closest to cursor
      candidates.sort((a, b) => b.idx - a.idx);
      const best = candidates[0];

      // Verify trigger character is at start of line or preceded by whitespace or bracket
      const prevChar = best.idx > 0 ? lastLine[best.idx - 1] : " ";
      if (/[\s\(\[\{]/.test(prevChar) || best.idx === 0) {
        const textAfterTrigger = lastLine.slice(best.idx + best.char.length);
        // If there is a closing bracket or newline, trigger is invalid
        if (!textAfterTrigger.includes("]") && !textAfterTrigger.includes("}") && (best.type === "note" || !textAfterTrigger.includes(" "))) {
          foundType = best.type;
          triggerChar = best.char;
          triggerIdxInLine = best.idx;
        }
      }
    }

    if (foundType && triggerIdxInLine !== -1) {
      const q = lastLine.slice(triggerIdxInLine + triggerChar.length);
      const absTriggerIndex = lineOffset + triggerIdxInLine;

      setMention({
        active: true,
        type: foundType,
        query: q,
        triggerIndex: absTriggerIndex,
        triggerChar,
      });
      setSelectedIndex(0);

      // Estimate position from cursor
      try {
        const rect = ta.getBoundingClientRect();
        // Compute approximate line and column
        const lines = textBefore.split("\n");
        const currentLineNum = lines.length;
        const currentCol = lines[lines.length - 1].length;
        const lineHeight = 24;
        const charWidth = 8.5;

        const left = Math.min(
          Math.max(16, rect.left + Math.min(currentCol * charWidth, rect.width - 280)),
          window.innerWidth - 300
        );
        const top = Math.min(
          rect.top + currentLineNum * lineHeight + 8,
          window.innerHeight - 260
        );

        setDropdownPos({ top, left });
      } catch {
        setDropdownPos(null);
      }
    } else {
      setMention((prev) => (prev.active ? { active: false, type: null, query: "", triggerIndex: -1, triggerChar: "" } : prev));
    }
  }, [value, textareaRef]);

  useEffect(() => {
    checkMention();
  }, [value, checkMention]);

  // Compute filtered items based on active mention type and query
  const items: MentionItem[] = (() => {
    if (!mention.active || !mention.type) return [];
    const q = mention.query.toLowerCase().trim();

    if (mention.type === "task") {
      const filtered = tasks.filter((t) => {
        if (!q) return !t.done;
        return t.title.toLowerCase().includes(q) || (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)));
      });
      return filtered.slice(0, 8).map((t) => {
        const p = projects.find((x) => x.id === t.projectId);
        return {
          id: t.id,
          type: "task",
          title: t.title,
          subtitle: p?.name ? `in ${p.name}` : undefined,
          emoji: t.emoji || "✓",
          color: p?.color,
          done: t.done,
        };
      });
    }

    if (mention.type === "project") {
      const filtered = projects.filter((p) => {
        if (!q) return true;
        return p.name.toLowerCase().includes(q);
      });
      return filtered.slice(0, 8).map((p) => ({
        id: p.id,
        type: "project",
        title: p.name,
        emoji: p.emoji || "📁",
        color: p.color,
      }));
    }

    if (mention.type === "note") {
      const filtered = notes.filter((n) => {
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          (n.day && n.day.toLowerCase().includes(q)) ||
          n.folderId.toLowerCase().includes(q)
        );
      });
      return filtered.slice(0, 8).map((n) => ({
        id: n.id,
        type: "note",
        title: n.title || (n.daily ? `Daily · ${n.day}` : "Untitled note"),
        subtitle: n.daily ? "Daily Log" : n.folderId === "f-vault" ? "Vault" : undefined,
        emoji: n.daily ? "📅" : "📝",
      }));
    }

    return [];
  })();

  const selectItem = useCallback(
    (item: MentionItem) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const beforeTrigger = value.slice(0, mention.triggerIndex);
      const afterCursor = value.slice(ta.selectionStart);

      let replacement = "";
      if (item.type === "note") {
        replacement = `[[${item.title}]] `;
      } else if (item.type === "project") {
        const cleanName = item.title.replace(/\s+/g, "-");
        replacement = `#${cleanName} `;
      } else if (item.type === "task") {
        const cleanTitle = item.title.replace(/\s+/g, "-");
        replacement = `@${cleanTitle} `;
      }

      const newValue = beforeTrigger + replacement + afterCursor;
      onChange(newValue);

      // Restore cursor position after the replacement
      const newCursor = beforeTrigger.length + replacement.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);

      setMention({ active: false, type: null, query: "", triggerIndex: -1, triggerChar: "" });
    },
    [value, mention, onChange, textareaRef]
  );

  // Keydown listener for arrow keys, Enter, Escape
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !mention.active || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (items[selectedIndex]) {
          e.preventDefault();
          selectItem(items[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMention({ active: false, type: null, query: "", triggerIndex: -1, triggerChar: "" });
      }
    };

    ta.addEventListener("keydown", handleKeyDown);
    return () => {
      ta.removeEventListener("keydown", handleKeyDown);
    };
  }, [mention.active, items, selectedIndex, selectItem, textareaRef]);

  if (!mention.active || items.length === 0 || !dropdownPos) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Mentions suggestions"
      className="fixed z-50 w-72 max-h-64 overflow-y-auto rounded-2xl border shadow-2xl p-1.5 transition-all overscroll-contain animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        background: "var(--panel)",
        borderColor: "var(--line)",
        boxShadow: "0 16px 40px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--line)",
      }}
    >
      <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--mut)] border-b border-[var(--line)] mb-1">
        <span className="flex items-center gap-1">
          {mention.type === "task" && <ListTodo size={11} className="text-accent" />}
          {mention.type === "project" && <Hash size={11} className="text-accent" />}
          {mention.type === "note" && <FileText size={11} className="text-accent" />}
          <span>
            {mention.type === "task"
              ? "Link Task (@)"
              : mention.type === "project"
              ? "Link Project (#)"
              : "Wiki Note ([])"}
          </span>
        </span>
        <span className="font-mono text-[9px] lowercase opacity-70">
          {mention.query ? `"${mention.query}"` : "type to filter"}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                selectItem(item);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer",
                isSelected
                  ? "bg-[var(--accent-soft)] text-[var(--text)] font-semibold"
                  : "text-[var(--text)] hover:bg-[var(--panel2)]"
              )}
            >
              {item.color ? (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ background: item.color }}
                />
              ) : item.emoji ? (
                <span className="shrink-0 text-sm">{item.emoji}</span>
              ) : null}

              <div className="min-w-0 flex-1 truncate">
                <div className={cn("truncate text-[12.5px]", item.done && "line-through opacity-60")}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="text-[10px] text-[var(--mut)] truncate">{item.subtitle}</div>
                )}
              </div>

              {item.done && <span className="text-[10px] text-emerald-500 font-bold shrink-0">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
