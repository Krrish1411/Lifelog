import { useState } from "react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Tiny, safe markdown renderer (no innerHTML).                        */
/* Supports: # headings, **bold**, *italic*, ~~strike~~, ==highlight==,*/
/* ++underline++, `code`, ``` fences, > quotes, - lists, 1. lists,     */
/* - [ ] / - [x] checklists, --- rules, [links](url).                  */
/* ------------------------------------------------------------------ */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // token regex, ordered: code, bold, underline(++), highlight, italic, strike, link, wiki [[note]], @task, #project
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\+\+[^+]+\+\+)|(==[^=]+==)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\((?:https?:\/\/)[^)\s]+\))|(\[\[[^\]]+\]\])|(@[a-zA-Z0-9_\-]+)|(#[a-zA-Z0-9_\-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${k++}`;
    if (tok.startsWith("`")) out.push(<code key={key} className="md-code">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (tok.startsWith("++")) out.push(<u key={key}>{inline(tok.slice(2, -2), key)}</u>);
    else if (tok.startsWith("==")) out.push(<mark key={key} className="md-mark">{inline(tok.slice(2, -2), key)}</mark>);
    else if (tok.startsWith("~~")) out.push(<s key={key}>{inline(tok.slice(2, -2), key)}</s>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    else if (tok.startsWith("[[") && tok.endsWith("]]")) {
      const inner = tok.slice(2, -2);
      const parts = inner.split("|");
      const target = parts[0].trim();
      const label = parts[1]?.trim() || target;
      out.push(
        <span
          key={key}
          className="md-wikilink inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold cursor-pointer transition-all hover:scale-105"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
          data-wiki-type="note"
          data-wiki-target={target}
          title={`Open note: ${target}`}
        >
          📄 {label}
        </span>
      );
    } else if (tok.startsWith("@") && tok.length > 1) {
      const taskName = tok.slice(1);
      out.push(
        <span
          key={key}
          className="md-tasklink inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold cursor-pointer transition-all hover:scale-105"
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            color: "#3b82f6",
            border: "1px solid rgba(59, 130, 246, 0.3)",
          }}
          data-wiki-type="task"
          data-wiki-target={taskName}
          title={`Reference task: ${taskName}`}
        >
          ☑️ @{taskName}
        </span>
      );
    } else if (tok.startsWith("#") && tok.length > 1) {
      const projName = tok.slice(1);
      out.push(
        <span
          key={key}
          className="md-projlink inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold cursor-pointer transition-all hover:scale-105"
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            color: "#10b981",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
          data-wiki-type="project"
          data-wiki-target={projName}
          title={`Project: ${projName}`}
        >
          📁 #{projName}
        </span>
      );
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm) out.push(<a key={key} href={mm[2]} target="_blank" rel="noreferrer" className="md-link">{mm[1]}</a>);
      else out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(src: string): ReactNode {
  const lines = src.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `b${key++}`;
    if (line.trim() === "") { i++; continue; }
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={k} className="md-pre">{buf.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = ["md-h1", "md-h2", "md-h3", "md-h4"][lvl - 1];
      blocks.push(<div key={k} className={cls}>{inline(h[2], k)}</div>);
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(<hr key={k} className="md-hr" />); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(<blockquote key={k} className="md-quote">{inline(buf.join(" "), k)}</blockquote>);
      continue;
    }
    const check = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (check || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      let ii = 0;
      while (i < lines.length) {
        const l = lines[i];
        const c = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(l);
        const ul = /^\s*[-*]\s+(.*)$/.exec(l);
        const ol = /^\s*\d+\.\s+(.*)$/.exec(l);
        if (c) {
          items.push(
            <li key={`${k}-${ii++}`} className="md-check">
              <span className={c[1].trim() ? "md-box on" : "md-box"}>{c[1].trim() ? "✓" : ""}</span>
              <span className={c[1].trim() ? "line-through opacity-60" : ""}>{inline(c[2], `${k}-${ii}`)}</span>
            </li>,
          );
          i++;
        } else if (ul && !ordered) {
          items.push(<li key={`${k}-${ii++}`} className="md-li">{inline(ul[1], `${k}-${ii}`)}</li>);
          i++;
        } else if (ol && ordered) {
          items.push(<li key={`${k}-${ii++}`} className="md-oli">{inline(ol[1], `${k}-${ii}`)}</li>);
          i++;
        } else break;
      }
      blocks.push(ordered ? <ol key={k} className="md-ol">{items}</ol> : <ul key={k} className="md-ul">{items}</ul>);
      continue;
    }
    blocks.push(<p key={k} className="md-p">{inline(line, k)}</p>);
    i++;
  }
  return <div className="md-root">{blocks}</div>;
}

/** Wrap/insert markdown syntax around the current selection of a textarea. */
export function applyWrap(ta: HTMLTextAreaElement, before: string, after: string, set: (v: string) => void): void {
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const sel = ta.value.slice(start, end) || "text";
  const next = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
  set(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + sel.length);
  });
}
export function applyLinePrefix(ta: HTMLTextAreaElement, prefix: string, set: (v: string) => void): void {
  const start = ta.selectionStart ?? 0;
  const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
  const next = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
  set(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + prefix.length, start + prefix.length);
  });
}
