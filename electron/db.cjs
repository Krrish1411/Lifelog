const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

let dbInstance = null;
let currentDbPath = null;

function initDatabase(dbPath) {
  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  currentDbPath = dbPath;
  dbInstance = new DatabaseSync(dbPath);

  // High performance SQLite tuning (WAL mode + normal synchronous)
  dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  // Create tables
  dbInstance.exec(`
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

function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}

function execSql(sql) {
  const db = getDb();
  return db.exec(sql);
}

function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function queryGet(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function runSql(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Save single row to specified table
 */
function saveRow(table, row) {
  const db = getDb();
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const columns = keys.join(', ');
  const updateList = keys.filter(k => k !== 'id' && k !== 'key' && k !== 'day_iso').map(k => `${k} = excluded.${k}`).join(', ');

  const conflictKey = table === 'meta' ? 'key' : (table === 'day_logs' ? 'day_iso' : 'id');
  const sql = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    ON CONFLICT(${conflictKey}) DO UPDATE SET ${updateList || `${conflictKey} = excluded.${conflictKey}`};
  `;
  const values = keys.map(k => row[k]);
  return db.prepare(sql).run(...values);
}

/**
 * Delete row from table
 */
function deleteRow(table, id) {
  const db = getDb();
  const keyCol = table === 'meta' ? 'key' : (table === 'day_logs' ? 'day_iso' : 'id');
  return db.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ?`).run(id);
}

/**
 * Load all entities in a single atomic read operation
 */
function loadAllData() {
  const db = getDb();
  return {
    meta: db.prepare('SELECT * FROM meta').all(),
    tasks: db.prepare('SELECT * FROM tasks WHERE is_deleted = 0').all(),
    notes: db.prepare('SELECT * FROM notes WHERE is_deleted = 0').all(),
    attachments: db.prepare('SELECT * FROM attachments').all(),
    habits: db.prepare('SELECT * FROM habits WHERE is_deleted = 0').all(),
    projects: db.prepare('SELECT * FROM projects WHERE is_deleted = 0').all(),
    folders: db.prepare('SELECT * FROM folders').all(),
    sessions: db.prepare('SELECT * FROM sessions').all(),
    dayLogs: db.prepare('SELECT * FROM day_logs').all(),
    appSettings: db.prepare('SELECT * FROM app_settings').all(),
  };
}

/**
 * Batch insert / replace within an atomic transaction
 */
function batchSave(table, rows) {
  if (!rows || rows.length === 0) return;
  const db = getDb();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    for (const row of rows) {
      saveRow(table, row);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Export a pristine, compacted SQLite database file using VACUUM INTO
 */
function exportBackup(destPath) {
  const db = getDb();
  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }
  // Escape destination path for SQL string
  const safeDest = destPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${safeDest}';`);
  return { success: true, path: destPath };
}

/**
 * Import and replace current database from an external SQLite / .lifelog backup
 */
function importBackup(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found at: ${sourcePath}`);
  }

  // Close current db instance if open
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }

  // Backup current DB to .bak before overwriting
  if (fs.existsSync(currentDbPath)) {
    const backupOld = `${currentDbPath}.bak`;
    fs.copyFileSync(currentDbPath, backupOld);
  }

  // Copy new backup over current DB
  fs.copyFileSync(sourcePath, currentDbPath);

  // Re-open and tune
  initDatabase(currentDbPath);
  return { success: true };
}

module.exports = {
  initDatabase,
  getDb,
  execSql,
  queryAll,
  queryGet,
  runSql,
  saveRow,
  deleteRow,
  loadAllData,
  batchSave,
  exportBackup,
  importBackup,
};
