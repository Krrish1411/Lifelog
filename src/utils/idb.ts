/* ------------------------------------------------------------------ */
/* IndexedDB storage layer — replaces localStorage for larger datasets */
/* Encrypted state is stored in a single key-value store.              */
/* ------------------------------------------------------------------ */

import { getDeviceKey } from "./crypto";
import type { State } from "../types";

const DB_NAME = "LifeLogDB";
const DB_VERSION = 1;
const STORE_NAME = "state";
const LS_KEY = "lifelog.state.v1";
const ERASED_KEY = "lifelog.erased.v1";

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      console.warn("IndexedDB not available — falling back to localStorage");
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

export async function loadStateFromIDB(): Promise<State | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(LS_KEY);
    req.onerror = () => resolve(null);
    req.onsuccess = async () => {
      const encrypted = req.result as string | undefined;
      if (!encrypted) {
        resolve(null);
        return;
      }
      try {
        const key = await getDeviceKey();
        const { decryptEnvelope } = await import("./crypto");
        const state = await decryptEnvelope<State>(key, encrypted);
        resolve(state);
      } catch {
        resolve(null);
      }
    };
  });
}

export async function saveStateToIDB(state: State): Promise<void> {
  const db = await openDB();
  if (!db) return;
  const key = await getDeviceKey();
  const { encryptEnvelope } = await import("./crypto");
  const encrypted = await encryptEnvelope(key, state);
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(encrypted, LS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadErasuredFlag(): Promise<boolean> {
  const db = await openDB();
  if (!db) {
    return !!localStorage.getItem(ERASED_KEY);
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(ERASED_KEY);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });
}

export async function saveErasedFlag(): Promise<void> {
  const db = await openDB();
  if (!db) {
    localStorage.setItem(ERASED_KEY, "1");
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put("1", ERASED_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function clearIDB(): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Migrate from localStorage to IndexedDB (one-time) */
export async function migrateToIDB(): Promise<boolean> {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  const db = await openDB();
  if (!db) return false;
  try {
    const key = await getDeviceKey();
    const { decryptEnvelope, encryptEnvelope } = await import("./crypto");
    const state = await decryptEnvelope<State>(key, raw);
    const encrypted = await encryptEnvelope(key, state);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(encrypted, LS_KEY);
      // Keep erased flag
      const erased = localStorage.getItem(ERASED_KEY);
      if (erased) store.put(erased, ERASED_KEY);
      tx.oncomplete = () => {
        // Clear localStorage after successful migration
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(ERASED_KEY);
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
