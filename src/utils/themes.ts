import type { Settings, ThemeMode, TokenKey } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export interface DesignerTheme {
  id: string;
  name: string;
  tag: string;
  desc: string;
  mode: ThemeMode;
  darkOnly?: boolean;
  counterpartId: string;
  accent: string;
  bg: string;
  tokens: Partial<Record<TokenKey, string>>;
  previewBg: string;
  previewAccent: string;
}

export const DARK_THEMES: DesignerTheme[] = [
  {
    id: "crimson-dark",
    name: "LifeLog Crimson Dark",
    tag: "Signature Crimson · Deep Slate Dark",
    desc: "Rich dark palette featuring LifeLog's signature crimson red highlights on deep velvet slate.",
    mode: "dark",
    counterpartId: "minimal-white",
    accent: "#ef4444",
    bg: "#090d14",
    tokens: {
      panel: "#0f1522",
      panel2: "#1c2436",
      line: "#29354d",
      text: "#f8fafc",
      mut: "#94a3b8",
      ok: "#34d399",
      warn: "#fbbf24",
      danger: "#ef4444",
    },
    previewBg: "#090d14",
    previewAccent: "#ef4444",
  },
  {
    id: "oled",
    name: "OLED Pure Black",
    tag: "Pitch Black · 0% Battery Drain",
    desc: "True #000000 black with crisp cyan highlights. Zero power draw on OLED screens.",
    mode: "dark",
    darkOnly: true,
    counterpartId: "minimal-white",
    accent: "#38bdf8",
    bg: "#000000",
    tokens: {
      panel: "#000000",
      panel2: "#0c0c0c",
      line: "#1e1e1e",
      text: "#f8fafc",
      mut: "#94a3b8",
      ok: "#34d399",
      warn: "#fbbf24",
      danger: "#f87171",
    },
    previewBg: "#000000",
    previewAccent: "#38bdf8",
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    tag: "Cyberpunk · Neon Twilight",
    desc: "Deep neon twilight inspired by nighttime Tokyo city streets and cyan-blue glow.",
    mode: "dark",
    counterpartId: "tokyo-day",
    accent: "#7aa2f7",
    bg: "#1a1b26",
    tokens: {
      panel: "#16161e",
      panel2: "#24283b",
      line: "#292e42",
      text: "#c0caf5",
      mut: "#787c99",
      ok: "#9ece6a",
      warn: "#e0af68",
      danger: "#f7768e",
    },
    previewBg: "#1a1b26",
    previewAccent: "#7aa2f7",
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    tag: "Soothing Pastel · Dark Slate",
    desc: "Harmonious pastel lavender accents on a deep velvety purple-slate canvas.",
    mode: "dark",
    counterpartId: "catppuccin-latte",
    accent: "#cba6f7",
    bg: "#1e1e2e",
    tokens: {
      panel: "#181825",
      panel2: "#313244",
      line: "#45475a",
      text: "#cdd6f4",
      mut: "#a6adc8",
      ok: "#a6e3a1",
      warn: "#f9e2af",
      danger: "#f38ba8",
    },
    previewBg: "#1e1e2e",
    previewAccent: "#cba6f7",
  },
  {
    id: "nord-frost",
    name: "Nord Frost",
    tag: "Arctic · North-Bluish Slate",
    desc: "Glacial, arctic palette engineered for prolonged reading and calm concentration.",
    mode: "dark",
    counterpartId: "nord-snow",
    accent: "#88c0d0",
    bg: "#2e3440",
    tokens: {
      panel: "#242933",
      panel2: "#3b4252",
      line: "#434c5e",
      text: "#eceff4",
      mut: "#d8dee9",
      ok: "#a3be8c",
      warn: "#ebcb8b",
      danger: "#bf616a",
    },
    previewBg: "#2e3440",
    previewAccent: "#88c0d0",
  },
  {
    id: "dracula",
    name: "Dracula Midnight",
    tag: "High Contrast · Gothic Purple",
    desc: "Vibrant high-contrast midnight palette featuring luminous orchid, mint, and pink.",
    mode: "dark",
    counterpartId: "warm-sepia",
    accent: "#bd93f9",
    bg: "#282a36",
    tokens: {
      panel: "#21222c",
      panel2: "#44475a",
      line: "#6272a4",
      text: "#f8f8f2",
      mut: "#6272a4",
      ok: "#50fa7b",
      warn: "#f1fa8c",
      danger: "#ff5555",
    },
    previewBg: "#282a36",
    previewAccent: "#bd93f9",
  },
  {
    id: "sage-dark",
    name: "Forest Sage",
    tag: "Botanical · Organic Deep Forest",
    desc: "Natural deep botanical dark green aesthetic tailored for deep work serenity.",
    mode: "dark",
    counterpartId: "sage-light",
    accent: "#5a9e74",
    bg: "#080d09",
    tokens: {
      panel: "#050806",
      panel2: "#101812",
      line: "#1a261d",
      text: "#e8f0ea",
      mut: "#8ba390",
      ok: "#6fbf8e",
      warn: "#e0b457",
      danger: "#d66853",
    },
    previewBg: "#080d09",
    previewAccent: "#5a9e74",
  },
];

export const LIGHT_THEMES: DesignerTheme[] = [
  {
    id: "minimal-white",
    name: "LifeLog Crimson Light",
    tag: "Signature Crimson · Crisp Paper Canvas",
    desc: "Clean light paper canvas with LifeLog's iconic vivid crimson red accents and pristine elevated surfaces.",
    mode: "light",
    counterpartId: "crimson-dark",
    accent: "#dc2626",
    bg: "#f8fafc",
    tokens: {
      panel: "#ffffff",
      panel2: "#f1f5f9",
      line: "#e2e8f0",
      text: "#0f172a",
      mut: "#64748b",
      ok: "#16a34a",
      warn: "#d97706",
      danger: "#dc2626",
    },
    previewBg: "#f8fafc",
    previewAccent: "#dc2626",
  },
  {
    id: "tokyo-day",
    name: "Tokyo Day",
    tag: "Editorial · Cobalt Daylight",
    desc: "Bright editorial daytime theme with cobalt blue highlights and warm graphite text.",
    mode: "light",
    counterpartId: "tokyo-night",
    accent: "#2563eb",
    bg: "#f4f6fb",
    tokens: {
      panel: "#ffffff",
      panel2: "#eaedf6",
      line: "#dbe0ee",
      text: "#1e293b",
      mut: "#64748b",
      ok: "#16a34a",
      warn: "#d97706",
      danger: "#dc2626",
    },
    previewBg: "#f4f6fb",
    previewAccent: "#2563eb",
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    tag: "Light Pastel · Soft Violet",
    desc: "Delicate light pastel aesthetic with gentle violet accents and pleasant soft contrast.",
    mode: "light",
    counterpartId: "catppuccin-mocha",
    accent: "#8839ef",
    bg: "#eff1f5",
    tokens: {
      panel: "#ffffff",
      panel2: "#e6e9ef",
      line: "#ccd0da",
      text: "#4c4f69",
      mut: "#6c6f85",
      ok: "#40a02b",
      warn: "#df8e1d",
      danger: "#d20f39",
    },
    previewBg: "#eff1f5",
    previewAccent: "#8839ef",
  },
  {
    id: "nord-snow",
    name: "Nord Snow Storm",
    tag: "Glacial Snow · Deep Teal",
    desc: "Cool crystalline snow-white theme with deep arctic teal accents for bright daytime focus.",
    mode: "light",
    counterpartId: "nord-frost",
    accent: "#007899",
    bg: "#eceff4",
    tokens: {
      panel: "#ffffff",
      panel2: "#e5e9f0",
      line: "#d8dee9",
      text: "#2e3440",
      mut: "#4c566a",
      ok: "#2e7d32",
      warn: "#a16207",
      danger: "#be123c",
    },
    previewBg: "#eceff4",
    previewAccent: "#007899",
  },
  {
    id: "warm-sepia",
    name: "Warm Sepia Paper",
    tag: "Bookish Cream · Terracotta",
    desc: "Gentle literary cream-toned paper with rich terracotta amber accents, zero eye strain.",
    mode: "light",
    counterpartId: "dracula",
    accent: "#c2410c",
    bg: "#fbf7ee",
    tokens: {
      panel: "#ffffff",
      panel2: "#f4ede0",
      line: "#e7decb",
      text: "#2e241c",
      mut: "#7c6c5b",
      ok: "#2e7d32",
      warn: "#b45309",
      danger: "#b91c1c",
    },
    previewBg: "#fbf7ee",
    previewAccent: "#c2410c",
  },
  {
    id: "sage-light",
    name: "Garden Sage",
    tag: "Fresh Herbs · Deep Green",
    desc: "Crisp morning garden theme with fresh botanical green accents and clean light cards.",
    mode: "light",
    counterpartId: "sage-dark",
    accent: "#2d6a4f",
    bg: "#f4f7f4",
    tokens: {
      panel: "#ffffff",
      panel2: "#e9efe9",
      line: "#d2ded2",
      text: "#1b2d21",
      mut: "#556e5c",
      ok: "#2d6a4f",
      warn: "#926315",
      danger: "#b91c1c",
    },
    previewBg: "#f4f7f4",
    previewAccent: "#2d6a4f",
  },
];

export const ALL_THEMES: Record<string, DesignerTheme> = [
  ...DARK_THEMES,
  ...LIGHT_THEMES,
].reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<string, DesignerTheme>);

export function getThemeById(id?: string): DesignerTheme | undefined {
  if (!id) return undefined;
  return ALL_THEMES[id];
}

/**
 * Returns partial Settings to apply when selecting a specific theme.
 */
export function applyThemePatch(theme: DesignerTheme): Partial<Settings> {
  return {
    designerTheme: theme.id,
    themeMode: theme.mode,
    accent: theme.accent,
    ...(theme.mode === "dark" ? { bgDark: theme.bg } : { bgLight: theme.bg }),
    tokens: { ...theme.tokens },
  };
}

/**
 * Dynamically toggles between Dark and Light mode.
 * If a designer theme is active, it seamlessly transforms into its matching counterpart!
 */
export function toggleThemeModePatch(current: Settings): Partial<Settings> {
  const nextMode: ThemeMode = current.themeMode === "dark" ? "light" : "dark";

  // If a designer theme is set, look up its counterpart for the new mode
  if (current.designerTheme && ALL_THEMES[current.designerTheme]) {
    const curTheme = ALL_THEMES[current.designerTheme];
    // If the theme is already in the target mode, keep it
    if (curTheme.mode === nextMode) {
      return applyThemePatch(curTheme);
    }
    // Look up counterpart
    const counterpart = ALL_THEMES[curTheme.counterpartId];
    if (counterpart && counterpart.mode === nextMode) {
      return applyThemePatch(counterpart);
    }
  }

  // Fallback if no specific theme counterpart found: clean mode switch with default theme
  const fallbackTheme = nextMode === "dark" ? DARK_THEMES[0] : LIGHT_THEMES[0];
  return {
    themeMode: nextMode,
    designerTheme: fallbackTheme.id,
    accent: fallbackTheme.accent,
    ...(nextMode === "dark" ? { bgDark: fallbackTheme.bg } : { bgLight: fallbackTheme.bg }),
    tokens: { ...fallbackTheme.tokens },
  };
}

/**
 * Factory reset: Reverts ALL theme, visual, font, and scaling customizations to 0.
 */
export function getUniversalResetPatch(): Partial<Settings> {
  return {
    designerTheme: undefined,
    themeMode: DEFAULT_SETTINGS.themeMode,
    accent: DEFAULT_SETTINGS.accent,
    bgDark: DEFAULT_SETTINGS.bgDark,
    bgLight: DEFAULT_SETTINGS.bgLight,
    tokens: {},
    customFontName: null,
    fontPair: DEFAULT_SETTINGS.fontPair,
    uiZoom: 100,
    reduceMotion: false,
    reduceTransparency: false,
    highContrast: false,
  };
}
