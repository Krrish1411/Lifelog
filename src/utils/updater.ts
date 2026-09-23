import { AppVersionInfo, APP_VERSION } from "../types";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json";
const FALLBACK_VERSION_URL =
  "https://krrish1411.github.io/Lifelog-Releases/version.json";
const DAILY_CHECK_DATE_KEY = "lifelog_last_update_check_date";

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
 * Returns immediately upon primary URL success to minimize bandwidth consumption (< 1 KB).
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
        connectTimeout: 7000,
        readTimeout: 7000,
      });
      if (response.status === 200 && response.data) {
        const parsed = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
        if (parsed?.version) return parsed;
      }
    } catch {}

    try {
      const response = await CapacitorHttp.get({
        url: fallbackUrl,
        connectTimeout: 7000,
        readTimeout: 7000,
      });
      if (response.status === 200 && response.data) {
        const parsed = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
        if (parsed?.version) return parsed;
      }
    } catch {}
  } else {
    // Helper for web/electron fetch with individual timeout and no custom headers (avoids CORS preflight)
    const fetchWithTimeout = async (url: string, timeoutMs: number = 7000) => {
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

    try {
      const p = await fetchWithTimeout(primaryUrl, 6000);
      if (p?.version) return p;
    } catch {}

    try {
      const f = await fetchWithTimeout(fallbackUrl, 6000);
      if (f?.version) return f;
    } catch {}
  }

  throw new Error("Could not reach the releases server. Verify your internet connection.");
}

/**
 * Silent daily update checker executed on app startup.
 * Checks exactly once per calendar day (on the first launch of that day).
 * Consumes < 1 KB of compressed data per check.
 * Returns AppVersionInfo if a newer version is available.
 */
export async function checkDailyUpdate(
  currentVersion: string = APP_VERSION
): Promise<AppVersionInfo | null> {
  try {
    const todayDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastCheckDate = typeof window !== "undefined" ? localStorage.getItem(DAILY_CHECK_DATE_KEY) : null;

    // Only query on the very first launch of each calendar day
    if (lastCheckDate === todayDate) {
      return null;
    }

    const data = await fetchRemoteVersionInfo();
    if (typeof window !== "undefined") {
      localStorage.setItem(DAILY_CHECK_DATE_KEY, todayDate);
    }

    if (isNewerVersion(data.version, currentVersion)) {
      return data;
    }
    return null;
  } catch {
    // Silent fail for daily background check to avoid interrupting the user if offline
    return null;
  }
}
