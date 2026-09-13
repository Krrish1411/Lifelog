/* ------------------------------------------------------------------ */
/* Unified LifeLog SQLite Database Layer (Desktop, Mobile, Web)       */
/* Handles row-level AES-GCM-256 E2EE, cross-platform persistence,     */
/* and portable .lifelog backup/restore operations.                   */
/* ------------------------------------------------------------------ */

import type { State, Task, Note, Attachment, Habit, Project, Folder, Session, DayLog, Settings, Meta, SqliteAllData } from "../types";
import { DEFAULT_SETTINGS, STATE_VERSION } from "../types";
import {
  getActiveVaultKey,
  encryptData,
  decryptData,
  deriveMasterKey,
  generateSalt,
  saltToB64,
  b64ToSalt,
  createVerificationPayload,
  verifyMasterKey,
  cacheMasterKeyOnDevice,
  getCachedMasterKey,
  clearCachedMasterKey,
} from "../security/masterKey";
import {
  initWebDatabase,
  webSaveRow,
  webDeleteRow,
  webBatchSave,
  webLoadAllData,
  webExportDatabase,
  webImportDatabase,
  webQueryAll,
} from "./webSqlite";

const isElectron = typeof window !== "undefined" && !!window.electronAPI;

export async function initDb(): Promise<void> {
  if (isElectron && window.electronAPI) {
    await window.electronAPI.dbInit();
  } else {
    await initWebDatabase();
  }
}

async function saveRow(table: string, row: Record<string, unknown>): Promise<void> {
  if (isElectron && window.electronAPI) {
    await window.electronAPI.dbSaveRow(table, row);
  } else {
    webSaveRow(table, row);
  }
}

async function batchSave(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  if (isElectron && window.electronAPI) {
    await window.electronAPI.dbBatchSave(table, rows);
  } else {
    webBatchSave(table, rows);
  }
}

async function loadRawData(): Promise<SqliteAllData | null> {
  if (isElectron && window.electronAPI) {
    return await window.electronAPI.dbLoadAll();
  } else {
    return webLoadAllData();
  }
}

/**
 * Load and decrypt the entire application state from the SQLite database.
 */
export async function loadFullStateFromDb(): Promise<State | null> {
  await initDb();
  const raw = await loadRawData();
  if (!raw) return null;

  // Check if database has any records at all
  const hasRecords =
    raw.tasks.length > 0 ||
    raw.notes.length > 0 ||
    raw.habits.length > 0 ||
    raw.projects.length > 0 ||
    raw.appSettings.length > 0;

  if (!hasRecords) {
    return null;
  }

  const key = await getActiveVaultKey();

  // Decrypt tasks
  const tasks: Task[] = [];
  for (const t of raw.tasks) {
    try {
      const decrypted = await decryptData<Task>(key, t.encrypted_payload);
      tasks.push({ ...decrypted, id: t.id });
    } catch (e) {
      console.warn(`Failed decrypting task ${t.id}:`, e);
    }
  }

  // Decrypt attachments indexed by note_id
  const attachmentsByNoteId: Record<string, Attachment[]> = {};
  if (raw.attachments && raw.attachments.length > 0) {
    for (const attRow of raw.attachments) {
      try {
        const decryptedAtt = await decryptData<Attachment>(key, attRow.encrypted_blob);
        if (!attachmentsByNoteId[attRow.note_id]) {
          attachmentsByNoteId[attRow.note_id] = [];
        }
        attachmentsByNoteId[attRow.note_id].push({ ...decryptedAtt, id: attRow.id });
      } catch (e) {
        console.warn(`Failed decrypting attachment ${attRow.id}:`, e);
      }
    }
  }

  // Decrypt notes & attach binary attachments
  const notes: Note[] = [];
  for (const n of raw.notes) {
    try {
      const decrypted = await decryptData<Note>(key, n.encrypted_payload);
      const noteAtts = attachmentsByNoteId[n.id] || decrypted.attachments || [];
      notes.push({ ...decrypted, id: n.id, attachments: noteAtts });
    } catch (e) {
      console.warn(`Failed decrypting note ${n.id}:`, e);
    }
  }

  // Decrypt habits
  const habits: Habit[] = [];
  for (const h of raw.habits) {
    try {
      const decrypted = await decryptData<Habit>(key, h.encrypted_payload);
      habits.push({ ...decrypted, id: h.id });
    } catch (e) {
      console.warn(`Failed decrypting habit ${h.id}:`, e);
    }
  }

  // Decrypt projects
  const projects: Project[] = [];
  for (const p of raw.projects) {
    try {
      const decrypted = await decryptData<Project>(key, p.encrypted_payload);
      projects.push({ ...decrypted, id: p.id });
    } catch (e) {
      console.warn(`Failed decrypting project ${p.id}:`, e);
    }
  }

  // Decrypt folders
  const folders: Folder[] = [];
  for (const f of raw.folders) {
    try {
      const decrypted = await decryptData<Folder>(key, f.encrypted_payload);
      folders.push({ ...decrypted, id: f.id });
    } catch (e) {
      console.warn(`Failed decrypting folder ${f.id}:`, e);
    }
  }

  // Decrypt sessions
  const sessions: Session[] = [];
  for (const s of raw.sessions) {
    try {
      const decrypted = await decryptData<Session>(key, s.encrypted_payload);
      sessions.push({ ...decrypted, id: s.id });
    } catch (e) {
      console.warn(`Failed decrypting session ${s.id}:`, e);
    }
  }

  // Decrypt day_logs
  const dayLogs: Record<string, DayLog> = {};
  for (const dl of raw.dayLogs) {
    try {
      const decrypted = await decryptData<DayLog>(key, dl.encrypted_payload);
      dayLogs[dl.day_iso] = decrypted;
    } catch (e) {
      console.warn(`Failed decrypting dayLog ${dl.day_iso}:`, e);
    }
  }

  // Decrypt app settings
  let settings: Settings | null = null;
  let metaObj: Meta | null = null;
  let tagColors: Record<string, string> = {};

  for (const settingRow of raw.appSettings) {
    try {
      const decrypted = await decryptData<unknown>(key, settingRow.encrypted_payload);
      if (settingRow.id === "settings") {
        settings = decrypted as Settings;
      } else if (settingRow.id === "meta") {
        metaObj = decrypted as Meta;
      } else if (settingRow.id === "tagColors") {
        tagColors = decrypted as Record<string, string>;
      }
    } catch (e) {
      console.warn(`Failed decrypting appSetting ${settingRow.id}:`, e);
    }
  }

  return {
    version: STATE_VERSION,
    projects,
    tasks,
    habits,
    folders,
    notes,
    sessions,
    dayLogs,
    tagColors,
    settings: settings || DEFAULT_SETTINGS,
    meta: metaObj || { createdAt: Date.now(), lastGreetingDay: null },
  };
}

/**
 * Persist the entire application state into SQLite with row-level encryption.
 */
export async function saveFullStateToDb(state: State): Promise<void> {
  await initDb();
  const key = await getActiveVaultKey();

  // 1. Prepare tasks
  const taskRows: Record<string, unknown>[] = [];
  for (const task of state.tasks) {
    const enc = await encryptData(key, task);
    taskRows.push({
      id: task.id,
      project_id: task.projectId || null,
      updated_at: task.createdAt || Date.now(),
      is_deleted: 0,
      encrypted_payload: enc,
    });
  }
  await batchSave("tasks", taskRows);

  // 2. Prepare notes & attachments
  const noteRows: Record<string, unknown>[] = [];
  const attachmentRows: Record<string, unknown>[] = [];
  for (const note of state.notes) {
    const enc = await encryptData(key, note);
    noteRows.push({
      id: note.id,
      folder_id: note.folderId || null,
      updated_at: note.updatedAt || Date.now(),
      is_deleted: 0,
      encrypted_payload: enc,
    });
    if (note.attachments && note.attachments.length > 0) {
      for (const att of note.attachments) {
        const encBlob = await encryptData(key, att);
        attachmentRows.push({
          id: att.id,
          note_id: note.id,
          mime_type: att.kind,
          byte_size: att.size,
          created_at: att.createdAt,
          encrypted_blob: encBlob,
        });
      }
    }
  }
  await batchSave("notes", noteRows);
  if (attachmentRows.length > 0) {
    await batchSave("attachments", attachmentRows);
  }

  // 3. Prepare habits
  const habitRows: Record<string, unknown>[] = [];
  for (const habit of state.habits) {
    const enc = await encryptData(key, habit);
    habitRows.push({
      id: habit.id,
      updated_at: habit.createdAt || Date.now(),
      is_deleted: 0,
      encrypted_payload: enc,
    });
  }
  await batchSave("habits", habitRows);

  // 4. Prepare projects
  const projectRows: Record<string, unknown>[] = [];
  for (const project of state.projects) {
    const enc = await encryptData(key, project);
    projectRows.push({
      id: project.id,
      updated_at: project.createdAt || Date.now(),
      is_deleted: 0,
      encrypted_payload: enc,
    });
  }
  await batchSave("projects", projectRows);

  // 5. Prepare folders
  const folderRows: Record<string, unknown>[] = [];
  for (const folder of state.folders) {
    const enc = await encryptData(key, folder);
    folderRows.push({
      id: folder.id,
      updated_at: Date.now(),
      encrypted_payload: enc,
    });
  }
  await batchSave("folders", folderRows);

  // 6. Prepare sessions
  const sessionRows: Record<string, unknown>[] = [];
  for (const session of state.sessions) {
    const enc = await encryptData(key, session);
    sessionRows.push({
      id: session.id,
      started_at: session.startedAt,
      updated_at: session.endedAt || session.startedAt || Date.now(),
      encrypted_payload: enc,
    });
  }
  await batchSave("sessions", sessionRows);

  // 7. Prepare day logs
  const dayLogRows: Record<string, unknown>[] = [];
  for (const [dayIso, dayLog] of Object.entries(state.dayLogs)) {
    const enc = await encryptData(key, dayLog);
    dayLogRows.push({
      day_iso: dayIso,
      updated_at: dayLog.updatedAt || Date.now(),
      encrypted_payload: enc,
    });
  }
  await batchSave("day_logs", dayLogRows);

  // 8. Prepare app settings & meta
  const settingsEnc = await encryptData(key, state.settings);
  const metaEnc = await encryptData(key, state.meta);
  const tagColorsEnc = await encryptData(key, state.tagColors);

  await batchSave("app_settings", [
    { id: "settings", encrypted_payload: settingsEnc },
    { id: "meta", encrypted_payload: metaEnc },
    { id: "tagColors", encrypted_payload: tagColorsEnc },
  ]);
}

/**
 * Configure or change Master Password for the vault.
 * Re-encrypts the vault with the new derived Master Key.
 */
export async function setVaultMasterPassword(password: string, currentState?: State): Promise<void> {
  const salt = generateSalt();
  const newKey = await deriveMasterKey(password, salt);
  const verificationPayload = await createVerificationPayload(newKey);

  // Save auth metadata to SQLite meta table
  await saveRow("meta", { key: "kdf_salt", value: saltToB64(salt) });
  await saveRow("meta", { key: "kdf_iterations", value: "600000" });
  await saveRow("meta", { key: "key_verification", value: verificationPayload });
  await saveRow("meta", { key: "has_master_password", value: "true" });

  // Cache on this trusted device
  await cacheMasterKeyOnDevice(newKey);

  // Re-encrypt and persist current state with the new key if state is provided
  if (currentState) {
    await saveFullStateToDb(currentState);
  }
}

/**
 * Check if the current database is protected by a Master Password.
 */
export async function getVaultAuthInfo(): Promise<{
  hasMasterPassword: boolean;
  isUnlocked: boolean;
}> {
  await initDb();
  let metaRows: { key: string; value: string }[] = [];
  if (isElectron && window.electronAPI) {
    metaRows = await window.electronAPI.dbQuery<{ key: string; value: string }>("SELECT * FROM meta");
  } else {
    metaRows = webQueryAll<{ key: string; value: string }>("SELECT * FROM meta");
  }

  const hasMasterPw = metaRows.some((r) => r.key === "has_master_password" && r.value === "true");
  const cachedKey = await getCachedMasterKey();

  return {
    hasMasterPassword: hasMasterPw,
    isUnlocked: !hasMasterPw || !!cachedKey,
  };
}

/**
 * Unlock database using Master Password on an unauthenticated device.
 */
export async function unlockVaultWithPassword(password: string): Promise<{ success: boolean; error?: string }> {
  await initDb();
  let metaRows: { key: string; value: string }[] = [];
  if (isElectron && window.electronAPI) {
    metaRows = await window.electronAPI.dbQuery<{ key: string; value: string }>("SELECT * FROM meta");
  } else {
    metaRows = webQueryAll<{ key: string; value: string }>("SELECT * FROM meta");
  }

  const saltRow = metaRows.find((r) => r.key === "kdf_salt");
  const verifyRow = metaRows.find((r) => r.key === "key_verification");

  if (!saltRow || !verifyRow) {
    return { success: false, error: "No Master Password configuration found in database." };
  }

  try {
    const salt = b64ToSalt(saltRow.value);
    const candidateKey = await deriveMasterKey(password, salt);
    const isValid = await verifyMasterKey(candidateKey, verifyRow.value);

    if (!isValid) {
      return { success: false, error: "Incorrect Master Password. Please try again." };
    }

    await cacheMasterKeyOnDevice(candidateKey);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Universal Backup Export (.lifelog)
 * Returns file path or triggers download.
 */
export async function exportVaultBackup(): Promise<{ success: boolean; path?: string; canceled?: boolean }> {
  if (isElectron && window.electronAPI) {
    const res = await window.electronAPI.dbExportBackup();
    return { success: !!res.success, path: res.path, canceled: res.canceled };
  }

  // Web / Mobile: Export SQLite WASM binary buffer as downloadable .lifelog file
  try {
    const bytes = webExportDatabase();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lifelog_backup_${now}.lifelog`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, path: a.download };
  } catch (err) {
    console.error("Export backup error:", err);
    return { success: false };
  }
}

/**
 * Universal Backup Import (.lifelog)
 */
export async function importVaultBackupFromFile(fileOrData: File | Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (isElectron && window.electronAPI) {
    // In electron, invoke dialog
    const res = await window.electronAPI.dbImportBackup();
    if (res.canceled) return { success: false, error: "Cancelled" };
    return { success: !!res.success, error: res.error };
  }

  // Web / Mobile
  try {
    let bytes: Uint8Array;
    if (fileOrData instanceof File) {
      const buffer = await fileOrData.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } else {
      bytes = fileOrData;
    }
    await webImportDatabase(bytes);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
