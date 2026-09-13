/* ------------------------------------------------------------------ */
/* Web / Mobile SQLite WASM Driver (sql.js + IndexedDB binary storage) */
/* Provides standard SQLite in Browser & Capacitor WebView            */
/* ------------------------------------------------------------------ */

import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import type { SqliteAllData } from "../types";

const IDB_NAME = "LifeLogSQLiteStorage";
const IDB_STORE = "sqlite_binary";
const DB_BLOB_KEY = "lifelog.sqlite3";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
let dbInstance: Database | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => `/${file}`,
    });
  }
  return sqlJsPromise;
}

function openBinaryIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not available"));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadBinaryFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openBinaryIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(DB_BLOB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function persistBinaryToIDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openBinaryIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(data, DB_BLOB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to persist SQLite binary to IndexedDB:", err);
  }
}

function schedulePersistence() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    if (dbInstance) {
      try {
        const exported = dbInstance.export();
        persistBinaryToIDB(exported).catch(console.error);
      } catch (err) {
        console.error("Failed exporting SQLite database:", err);
      }
    }
  }, 400);
}

export async function initWebDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await getSqlJs();
  const binary = await loadBinaryFromIDB();

  if (binary && binary.byteLength > 0) {
    try {
      dbInstance = new SQL.Database(binary);
    } catch (e) {
      console.warn("Corrupt SQLite cache, creating fresh database:", e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables & indexes
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT,
      mime_type TEXT,
      byte_size INTEGER,
      created_at INTEGER,
      encrypted_blob TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER,
      updated_at INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS day_logs (
      day_iso TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      encrypted_payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      encrypted_payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);
    CREATE INDEX IF NOT EXISTS idx_habits_updated ON habits(updated_at);
  `);

  return dbInstance;
}

export function getWebDb(): Database {
  if (!dbInstance) {
    throw new Error("Web SQLite not initialized. Call initWebDatabase() first.");
  }
  return dbInstance;
}

export function webSaveRow(table: string, row: Record<string, unknown>): void {
  const db = getWebDb();
  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  const columns = keys.join(", ");
  const updateList = keys
    .filter((k) => k !== "id" && k !== "key" && k !== "day_iso")
    .map((k) => `${k} = excluded.${k}`)
    .join(", ");

  const conflictKey = table === "meta" ? "key" : table === "day_logs" ? "day_iso" : "id";
  const sql = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    ON CONFLICT(${conflictKey}) DO UPDATE SET ${updateList || `${conflictKey} = excluded.${conflictKey}`};
  `;
  const values = keys.map((k) => (row[k] === undefined ? null : row[k]));
  db.run(sql, values as (string | number | null | Uint8Array)[]);
  schedulePersistence();
}

export function webDeleteRow(table: string, id: string): void {
  const db = getWebDb();
  const keyCol = table === "meta" ? "key" : table === "day_logs" ? "day_iso" : "id";
  db.run(`DELETE FROM ${table} WHERE ${keyCol} = ?`, [id]);
  schedulePersistence();
}

export function webBatchSave(table: string, rows: Record<string, unknown>[]): void {
  if (!rows || rows.length === 0) return;
  const db = getWebDb();
  db.run("BEGIN TRANSACTION;");
  try {
    for (const row of rows) {
      webSaveRow(table, row);
    }
    db.run("COMMIT;");
  } catch (e) {
    db.run("ROLLBACK;");
    throw e;
  }
  schedulePersistence();
}

export function webQueryAll<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null | Uint8Array)[] = []
): T[] {
  const db = getWebDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function webLoadAllData(): SqliteAllData {
  return {
    meta: webQueryAll("SELECT * FROM meta"),
    tasks: webQueryAll("SELECT * FROM tasks WHERE is_deleted = 0"),
    notes: webQueryAll("SELECT * FROM notes WHERE is_deleted = 0"),
    attachments: webQueryAll("SELECT * FROM attachments"),
    habits: webQueryAll("SELECT * FROM habits WHERE is_deleted = 0"),
    projects: webQueryAll("SELECT * FROM projects WHERE is_deleted = 0"),
    folders: webQueryAll("SELECT * FROM folders"),
    sessions: webQueryAll("SELECT * FROM sessions"),
    dayLogs: webQueryAll("SELECT * FROM day_logs"),
    appSettings: webQueryAll("SELECT * FROM app_settings"),
  };
}

export function webExportDatabase(): Uint8Array {
  const db = getWebDb();
  return db.export();
}

export async function webImportDatabase(bytes: Uint8Array): Promise<void> {
  const SQL = await getSqlJs();
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
  }
  dbInstance = new SQL.Database(bytes);
  await persistBinaryToIDB(bytes);
}
