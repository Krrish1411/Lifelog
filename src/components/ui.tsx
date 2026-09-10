import { useEffect, useState, useRef, forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { Plus, Search, X, ChevronDown, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeHex } from "../utils/core";
import { useBodyScrollLock } from "../utils/scrollLock";

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
    borderRadius: 12,
    fontWeight: 650,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    transition: "all .2s cubic-bezier(0.16, 1, 0.3, 1)",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    ...(size === "sm"
      ? { padding: "5px 12px", fontSize: 12 }
      : size === "lg"
        ? { padding: "11px 20px", fontSize: 14 }
        : { padding: "8px 15px", fontSize: 13 }),
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 92%, white 8%) 0%, var(--accent) 100%)",
      color: "var(--on-accent)",
      borderColor: "color-mix(in srgb, var(--accent) 80%, black 20%)",
      boxShadow: "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.35), 0 6px 18px -4px color-mix(in srgb, var(--accent) 45%, transparent)",
    },
    soft: {
      background: "color-mix(in srgb, var(--panel2) 65%, transparent)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      color: "var(--text)",
      borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
      boxShadow: "inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.08)",
    },
    ghost: { background: "transparent", color: "var(--mut)" },
    outline: {
      background: "color-mix(in srgb, var(--panel) 40%, transparent)",
      color: "var(--text)",
      borderColor: "color-mix(in srgb, var(--line) 90%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
    danger: {
      background: "color-mix(in srgb, var(--danger) 12%, transparent)",
      color: "var(--danger)",
      borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)",
    },
  };
  return (
    <button
      className={cn("select-none active:scale-[0.96] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45", className)}
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
  zIndex = 70,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
  zIndex?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useBodyScrollLock(open);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fadein fixed inset-0 flex items-start justify-center overflow-y-auto p-3 sm:p-5 overscroll-contain"
      style={{
        background: "rgba(0, 0, 0, 0.62)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        zIndex,
        paddingTop: "max(calc(var(--safe-top, 0px) + 12px), 3vh)",
        paddingBottom: "max(calc(var(--safe-bottom, 0px) + 16px), 24px)",
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pop w-full max-w-[calc(100vw-24px)] rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          maxWidth: `min(${typeof width === "number" ? `${width}px` : width}, calc(100vw - 24px))`,
          background: "color-mix(in srgb, var(--panel) 82%, transparent)",
          borderColor: "color-mix(in srgb, var(--line) 85%, transparent)",
          backdropFilter: "blur(36px) saturate(200%)",
          WebkitBackdropFilter: "blur(36px) saturate(200%)",
          boxShadow: "0 32px 80px -20px rgba(0,0,0,0.85), inset 0 1.25px 0.5px 0 rgba(255,255,255,0.22)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4 shrink-0"
          style={{ borderColor: "color-mix(in srgb, var(--line) 80%, transparent)" }}
        >
          <div className="font-display text-[16px] font-bold tracking-tight">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:opacity-75 cursor-pointer"
            style={{ color: "var(--mut)" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 overscroll-contain">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 bg-[var(--panel)]"
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
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    const {
      className,
      type = "text",
      autoCapitalize,
      autoComplete,
      autoCorrect,
      spellCheck,
      ...rest
    } = props;
    const isTextLike = !type || type === "text" || type === "search";
    return (
      <input
        ref={ref}
        type={type}
        className={cn("inp", className)}
        autoCapitalize={autoCapitalize ?? (isTextLike ? "sentences" : undefined)}
        autoComplete={autoComplete ?? (isTextLike ? "on" : undefined)}
        autoCorrect={autoCorrect ?? (isTextLike ? "on" : undefined)}
        spellCheck={spellCheck ?? (isTextLike ? true : undefined)}
        {...(isTextLike ? ({ writingsuggestions: "true" } as any) : {})}
        {...rest}
      />
    );
  }
);
TextInput.displayName = "TextInput";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => {
    const {
      className,
      autoCapitalize = "sentences",
      autoComplete = "on",
      autoCorrect = "on",
      spellCheck = true,
      ...rest
    } = props;
    return (
      <textarea
        ref={ref}
        className={cn("inp", className)}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        {...({ writingsuggestions: "true" } as any)}
        {...rest}
      />
    );
  }
);
TextArea.displayName = "TextArea";
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

/* ---------------- Themed Select Dropdown ---------------- */
export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  size = "md",
  disabled = false,
  width,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  width?: string | number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div
      ref={ref}
      className={cn("relative inline-block text-left", className)}
      style={{ width: width ? (typeof width === "number" ? `${width}px` : width) : undefined }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border font-bold transition-all cursor-pointer select-none",
          size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-2 text-[13px]",
          open ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--line-hi)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ color: "var(--text)", background: "var(--panel2)" }}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          size={size === "sm" ? 12 : 14}
          className={cn("shrink-0 text-[var(--mut)] transition-transform duration-150", open && "rotate-180 text-[var(--accent)]")}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-[240px] w-full min-w-[140px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
          style={{ background: "var(--panel)" }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold transition-colors cursor-pointer select-none",
                  size === "sm" ? "text-[11.5px]" : "text-[12.5px]",
                  isSelected
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold"
                    : "text-[var(--text)] hover:bg-[var(--panel2)]",
                  opt.disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check size={13} className="shrink-0 text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
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
    <span className="search-wrap max-w-full" style={{ width, maxWidth: "100%" }}>
      <Search size={14} />
      <input
        className="inp max-w-full"
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
