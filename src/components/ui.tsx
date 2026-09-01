import { useEffect, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeHex } from "../utils/core";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Buttons ---------------- */
type BtnVariant = "primary" | "soft" | "ghost" | "danger" | "outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
}
export function Btn({ variant = "soft", size = "md", className, style, ...rest }: BtnProps) {
  const base: React.CSSProperties = {
    borderRadius: 10,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    transition: "all .15s ease",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    ...(size === "sm"
      ? { padding: "4px 10px", fontSize: 12 }
      : size === "lg"
        ? { padding: "10px 18px", fontSize: 14 }
        : { padding: "7px 13px", fontSize: 13 }),
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "var(--on-accent)" },
    soft: { background: "var(--panel2)", color: "var(--text)", borderColor: "var(--line)" },
    ghost: { background: "transparent", color: "var(--mut)" },
    outline: { background: "transparent", color: "var(--text)", borderColor: "var(--line)" },
    danger: { background: "transparent", color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)" },
  };
  return (
    <button
      className={cn("select-none active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45", className)}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    />
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fadein fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pt-[7vh]"
      style={{ background: "rgba(4,8,6,0.66)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pop w-full rounded-2xl border shadow-2xl"
        style={{ maxWidth: width, background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="font-display text-[15px] font-bold tracking-tight">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:opacity-75"
            style={{ color: "var(--mut)" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 border-t px-5 py-3.5"
            style={{ borderColor: "var(--line)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Form primitives ---------------- */
export function Labeled({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="lbl">
        {label}
        {hint && <span style={{ color: "var(--mut)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}> · {hint}</span>}
      </span>
      {children}
    </div>
  );
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn("inp", className)} {...rest} />;
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-[13px] font-semibold"
      style={{ color: "var(--text)", cursor: "pointer" }}
    >
      <span
        className="relative inline-block h-[20px] w-[36px] rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--line)" }}
      >
        <span
          className="absolute top-[2px] h-[16px] w-[16px] rounded-full transition-all"
          style={{ left: checked ? 18 : 2, background: checked ? "var(--on-accent)" : "var(--mut)" }}
        />
      </span>
      {label}
    </button>
  );
}
export function Seg<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-xl border p-0.5"
      style={{ background: "var(--bg)", borderColor: "var(--line)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn("rounded-[9px] font-bold transition-all", size === "sm" ? "px-2 py-0.5 text-[11.5px]" : "px-2.5 py-1 text-[12.5px]")}
            style={
              active
                ? { background: "var(--accent)", color: "var(--on-accent)" }
                : { color: "var(--mut)", cursor: "pointer" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Color picker (swatches + custom hex always visible) ---------------- */
const SWATCHES = ["#e8a33d", "#d66853", "#6fbf8e", "#4fa3a5", "#7f9cd6", "#c079b8", "#a3b34f", "#8b93a5"];
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = normalizeHex(draft);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-7 w-7 rounded-full transition-transform hover:scale-110"
          style={{
            background: c,
            outline: value.toLowerCase() === c ? "2px solid var(--text)" : "none",
            outlineOffset: 2,
            cursor: "pointer",
          }}
          aria-label={`Color ${c}`}
        />
      ))}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-7 w-7 rounded-full border"
          style={{ background: valid ?? "transparent", borderColor: "var(--line)" }}
        />
        <input
          className="inp w-[104px]"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = normalizeHex(e.target.value);
            if (n) onChange(n);
          }}
          placeholder="#e8a33d"
          spellCheck={false}
        />
      </div>
      {!valid && <span className="text-[11.5px] font-semibold" style={{ color: "var(--danger)" }}>Enter a hex like #4fa3a5</span>}
    </div>
  );
}

/* ---------------- Emoji picker ---------------- */
const EMOJIS = ["🌐","🧠","🏠","📚","🎨","⏱️","📖","🧾","💶","🧭","🏦","📞","🗓️","✍️","🎯","💪","🧘","🏃","🚴","🌱","💡","🔧","📊","🎧","🎬","🍳","🧹","🛒","✈️","💊","🐶","☕","🎹","📷","🧪","⚙️","📝","🔒","🗂️","💼","🎁","🌙","⭐","🔥"];
export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div>
      <div className="flex max-h-[104px] flex-wrap gap-1 overflow-y-auto pr-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[17px] transition-all hover:scale-110"
            style={{
              background: value === e ? "var(--accent-soft)" : "transparent",
              outline: value === e ? "1.5px solid var(--accent)" : "none",
              cursor: "pointer",
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="inp w-[130px]"
          value={custom}
          maxLength={4}
          onChange={(e) => {
            setCustom(e.target.value);
            if (e.target.value.trim()) onChange(e.target.value.trim());
          }}
          placeholder="or type any emoji"
        />
        {value && (
          <Btn size="sm" variant="ghost" type="button" onClick={() => { onChange(""); setCustom(""); }}>
            Clear
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tag input (no “#” prefix, casing preserved) ---------------- */
export function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!tags.some((t) => t.toLowerCase() === v.toLowerCase())) onChange([...tags, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="chip" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--line))" }}>
          {t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            style={{ color: "var(--mut)", cursor: "pointer" }}
            aria-label={`Remove tag ${t}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        className="inp w-[132px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Add tag…"
      />
      <Btn size="sm" type="button" onClick={add}>
        <Plus size={12} /> Tag
      </Btn>
    </div>
  );
}

/* ---------------- Search input (icon + text never overlap) ---------------- */
export function SearchInput({
  value,
  onChange,
  placeholder,
  width = 220,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
  autoFocus?: boolean;
}) {
  return (
    <span className="search-wrap" style={{ width }}>
      <Search size={14} />
      <input
        className="inp"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        spellCheck={false}
      />
    </span>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rise flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{ borderColor: "var(--line)", color: "var(--mut)", background: "var(--panel2)" }}
      >
        <Icon size={20} />
      </div>
      <div className="font-display text-[15px] font-bold">{title}</div>
      {body && (
        <div className="max-w-[340px] text-[12.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
          {body}
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ---------------- Horizontal bar row (reports) ---------------- */
export function BarRow({
  label,
  value,
  max,
  color,
  right,
  sub,
}: {
  label: ReactNode;
  value: number;
  max: number;
  color: string;
  right?: ReactNode;
  sub?: ReactNode;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-bold">{label}</span>
        <span className="tnum shrink-0 font-semibold" style={{ color: "var(--mut)" }}>{right}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {sub && <div className="mt-0.5 text-[11px]" style={{ color: "var(--mut)" }}>{sub}</div>}
    </div>
  );
}
