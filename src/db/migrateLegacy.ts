/* ------------------------------------------------------------------ */
/* 1-Time User Data Migration to Unified SQLite Database Engine        */
/* Executes atomically once, converts legacy JSON/IDB to SQLite tables */
/* and is permanently bypassed on subsequent launches.                */
/* ------------------------------------------------------------------ */

import type { State } from "../types";
import { getDeviceKey, decryptEnvelope } from "../utils/crypto";
import { loadStateFromIDB } from "../utils/idb";
import { initDb, saveFullStateToDb } from "./database";
import { webQueryAll, webSaveRow } from "./webSqlite";

const isElectron = typeof window !== "undefined" && !!window.electronAPI;
const MIGRATION_LS_KEY = "lifelog.migrated_to_sqlite.v1";

export async function runOneTimeLegacyMigration(): Promise<State | null> {
  // Ultra-fast preliminary check
  if (typeof localStorage !== "undefined" && localStorage.getItem(MIGRATION_LS_KEY) === "1") {
    return null;
  }

  await initDb();

  // Check database meta table
  let metaRows: { key: string; value: string }[] = [];
  try {
    if (isElectron && window.electronAPI) {
      metaRows = await window.electronAPI.dbQuery<{ key: string; value: string }>(
        "SELECT * FROM meta WHERE key = 'migrated_to_sqlite'"
      );
    } else {
      metaRows = webQueryAll<{ key: string; value: string }>(
        "SELECT * FROM meta WHERE key = 'migrated_to_sqlite'"
      );
    }
  } catch {
    metaRows = [];
  }

  if (metaRows.some((r) => r.key === "migrated_to_sqlite" && r.value === "true")) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MIGRATION_LS_KEY, "1");
    }
    return null;
  }

  const startTime = performance.now();
  let legacyState: State | null = null;
  const key = await getDeviceKey();

  // 1. Try loading from Electron native vault file
  if (isElectron && window.electronAPI) {
    try {
      const diskData = await window.electronAPI.loadVault();
      if (diskData && key) {
        legacyState = await decryptEnvelope<State>(key, diskData);
      }
    } catch (e) {
      console.warn("[Migration] Failed reading legacy Electron vault:", e);
    }
  }

  // 2. Try loading from legacy IndexedDB
  if (!legacyState) {
    try {
      legacyState = await loadStateFromIDB();
    } catch (e) {
      console.warn("[Migration] Failed reading legacy IndexedDB:", e);
    }
  }

  // 3. Try loading from legacy localStorage
  if (!legacyState && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("lifelog.state.v1");
      if (raw && key) {
        legacyState = await decryptEnvelope<State>(key, raw);
      }
    } catch (e) {
      console.warn("[Migration] Failed reading legacy localStorage:", e);
    }
  }

  // If existing user data was found, migrate it into SQLite
  if (legacyState) {
    try {
      await saveFullStateToDb(legacyState);

      const markMigration = async () => {
        const row = { key: "migrated_to_sqlite", value: "true" };
        if (isElectron && window.electronAPI) {
          await window.electronAPI.dbSaveRow("meta", row);
        } else {
          webSaveRow("meta", row);
        }
      };
      await markMigration();

      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MIGRATION_LS_KEY, "1");
      }

      const duration = (performance.now() - startTime).toFixed(1);
      console.info(`[LifeLog] Successfully migrated legacy data to SQLite in ${duration}ms.`);
      return legacyState;
    } catch (err) {
      console.error("[Migration] Failed saving legacy data to SQLite:", err);
    }
  } else {
    // No legacy data found (fresh install) -> mark as completed so it never checks again
    const row = { key: "migrated_to_sqlite", value: "true" };
    if (isElectron && window.electronAPI) {
      await window.electronAPI.dbSaveRow("meta", row);
    } else {
      webSaveRow("meta", row);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MIGRATION_LS_KEY, "1");
    }
  }

  return null;
}
