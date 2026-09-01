/* Custom font upload: the file is registered with the FontFace API and its
   base64 data kept in localStorage so it survives reloads. Nothing leaves
   the device. */

const LS_KEY = "lifelog.customfont.v1";
export const CUSTOM_FONT_FAMILY = "LifeLog Custom";

interface StoredFont {
  name: string;
  dataUrl: string;
}

function register(dataUrl: string): void {
  try {
    const face = new FontFace(CUSTOM_FONT_FAMILY, `url(${dataUrl})`);
    document.fonts.add(face);
    face.load().catch(() => undefined);
  } catch {
    /* FontFace unsupported — ignore */
  }
}

export function loadStoredFont(): string | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const f = JSON.parse(raw) as StoredFont;
    if (f?.dataUrl) {
      register(f.dataUrl);
      return f.name || CUSTOM_FONT_FAMILY;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveCustomFont(name: string, dataUrl: string): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ name, dataUrl }));
    register(dataUrl);
  } catch {
    /* file too large for localStorage */
  }
}

export function clearCustomFont(): void {
  localStorage.removeItem(LS_KEY);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
