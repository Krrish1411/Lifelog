import { AppVersionInfo, APP_VERSION } from "../types";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json";
const FALLBACK_VERSION_URL =
  "https://krrish1411.github.io/Lifelog-Releases/version.json";
const LAST_CHECK_KEY = "lifelog_last_update_check";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Compare two semver strings (e.g. "1.1.1" vs "1.1.0").
 * Returns true if remote is strictly newer than current.
 */
export function isNewerVersion(remote: string, current: string): boolean {
  const rParts = remote.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const cParts = current.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Fetch the latest release descriptor from the canonical public releases repository.
 * Uses native CapacitorHttp on Android (bypasses WebView CORS completely).
 * Uses simple GET without preflight headers on Web/Electron.
 */
export async function fetchRemoteVersionInfo(): Promise<AppVersionInfo> {
  const ts = Date.now();
  const primaryUrl = `${REMOTE_VERSION_URL}?_t=${ts}`;
  const fallbackUrl = `${FALLBACK_VERSION_URL}?_t=${ts}`;

  // 1. On Native Android / iOS, try native CapacitorHttp (bypasses WebView CORS completely)
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url: primaryUrl,
        connectTimeout: 9000,
        readTimeout: 9000,
      });
      if (response.status === 200 && response.data) {
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      }
    } catch {}

    try {
      const response = await CapacitorHttp.get({
        url: fallbackUrl,
        connectTimeout: 9000,
        readTimeout: 9000,
      });
      if (response.status === 200 && response.data) {
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      }
    } catch {}
  }

  // Helper for web/electron fetch with individual timeout and no custom headers (avoids CORS preflight)
  const fetchWithTimeout = async (url: string, timeoutMs: number = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  // 2. Primary GitHub raw content fetch
  try {
    return await fetchWithTimeout(primaryUrl, 7000);
  } catch {}

  // 3. Fallback to GitHub Pages
  try {
    return await fetchWithTimeout(fallbackUrl, 7000);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Update check timed out. Verify your internet connection.");
    }
  }

  throw new Error("Could not reach the releases server. Verify your internet connection.");
}

/**
 * Silent daily update checker executed on app startup.
 * Checks at most once every 24 hours. Returns AppVersionInfo if a newer version is available.
 */
export async function checkDailyUpdate(
  currentVersion: string = APP_VERSION
): Promise<AppVersionInfo | null> {
  try {
    const lastCheckStr = typeof window !== "undefined" ? localStorage.getItem(LAST_CHECK_KEY) : null;
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
    const now = Date.now();

    // Only query if 24 hours have elapsed since the previous check
    if (now - lastCheck < CHECK_INTERVAL_MS) {
      return null;
    }

    const data = await fetchRemoteVersionInfo();
    localStorage.setItem(LAST_CHECK_KEY, now.toString());

    if (isNewerVersion(data.version, currentVersion)) {
      return data;
    }
    return null;
  } catch {
    // Silent fail for daily background check to avoid interrupting the user if offline
    return null;
  }
}
