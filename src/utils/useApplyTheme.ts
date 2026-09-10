import { useEffect } from "react";
import type { Settings, TokenKey } from "../types";
import { FONT_PAIRS } from "../types";
import { ensureContrast, mix, normalizeHex, readableOn } from "./core";
import { CUSTOM_FONT_FAMILY } from "./fonts";

/**
 * Applies the complete LifeLog theme, CSS custom properties, font pairs,
 * and accessibility data-attributes to the root document.
 * Used in both the primary Shell and secondary windows (like TimerPopout).
 */
export function useApplyTheme(s: Settings) {
  useEffect(() => {
    if (!s) return;
    const dark = s.themeMode === "dark";
    let bg = normalizeHex(dark ? s.bgDark : s.bgLight) ?? (dark ? "#07090e" : "#f8fafc");
    if (dark && (bg === "#0f1714" || bg === "#000000" || !bg)) bg = "#07090e";
    if (!dark && (!bg || bg === "#ffffff")) bg = "#f8fafc";
    const isOled = dark && s.bgDark === "#000000";

    const derived: Record<TokenKey, string> = {
      text: dark ? "#f3f4f6" : "#0f172a",
      mut: dark ? "" : "#64748b",
      panel: isOled ? "#080808" : dark ? mix(bg, "#ffffff", 0.045) : "#ffffff",
      panel2: isOled ? "#121212" : dark ? mix(bg, "#ffffff", 0.09) : mix(bg, "#000000", 0.04),
      line: isOled ? "#1f1f1f" : dark ? mix(bg, "#ffffff", 0.14) : mix(bg, "#000000", 0.10),
      ok: dark ? "#6fbf8e" : "#16a34a",
      warn: dark ? "#e0b457" : "#d97706",
      danger: dark ? "#ef4444" : "#dc2626",
    };

    if (dark) {
      derived.mut = mix(derived.text, bg, 0.45);
    }

    (Object.keys(derived) as TokenKey[]).forEach((k) => {
      const o = s.tokens[k];
      if (o && normalizeHex(o)) derived[k] = normalizeHex(o)!;
    });

    derived.text = ensureContrast(derived.text, bg, 7);
    derived.mut = ensureContrast(derived.mut, bg, 4.6);
    derived.ok = ensureContrast(derived.ok, bg, 3);
    derived.warn = ensureContrast(derived.warn, bg, 3);
    derived.danger = ensureContrast(derived.danger, bg, 3);

    const accentInput =
      !s.accent || s.accent.toLowerCase() === "#d97706"
        ? dark
          ? "#ef4444"
          : "#dc2626"
        : s.accent;
    const rawAccent = normalizeHex(accentInput) ?? (dark ? "#ef4444" : "#dc2626");
    const accent = ensureContrast(rawAccent, bg, 4.2);

    const root = document.documentElement;
    root.style.setProperty("--bg", bg);
    (Object.keys(derived) as TokenKey[]).forEach((k) =>
      root.style.setProperty(`--${k}`, derived[k])
    );
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--on-accent", readableOn(accent));
    root.style.setProperty("--ring", `color-mix(in srgb, ${accent} 32%, transparent)`);
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 14%, transparent)`);
    root.style.setProperty("--uizoom", String(Math.max(1, Math.min(2, s.uiZoom / 100))));

    const fam = s.customFontName
      ? `'${CUSTOM_FONT_FAMILY}', sans-serif`
      : `'${FONT_PAIRS[s.fontPair]?.family ?? "Manrope"}', sans-serif`;
    root.style.setProperty("--font-body", fam);
    root.style.setProperty("--font-display", fam);
    document.body.style.fontFamily = fam;

    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.engine = s.layout ?? "glass";
    root.dataset.mobileEngine = s.mobileLayout ?? "classic";
    root.style.background = bg;
    root.style.color = derived.text;
    document.body.style.background = bg;
    document.body.style.color = derived.text;
    root.dataset.reduceMotion = String(s.reduceMotion);
    root.dataset.reduceTransparency = String(s.reduceTransparency);
    root.dataset.highContrast = String(s.highContrast);
  }, [s]);
}
