import { AppVersionInfo, APP_VERSION } from "../types";

const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/Krrish1411/Lifelog-Releases/main/version.json";
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
 */
export async function fetchRemoteVersionInfo(): Promise<AppVersionInfo> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(REMOTE_VERSION_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: AppVersionInfo = await res.json();
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Update check timed out. You may be offline or connection was slow.");
    }
    throw new Error("Could not reach releases server. Verify your connection.");
  }
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
