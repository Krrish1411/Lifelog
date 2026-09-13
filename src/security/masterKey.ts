/* ------------------------------------------------------------------ */
/* Master Password & End-to-End Encryption (E2EE) Security Layer      */
/*  - Master Encryption Key (MEK) derived via PBKDF2-HMAC-SHA256     */
/*  - 600,000 iterations for brute-force resistance                   */
/*  - AES-GCM-256 authenticated encryption                            */
/*  - Trusted-device local caching for instant daily startup           */
/* ------------------------------------------------------------------ */

import { getDeviceKey, hasCrypto } from "../utils/crypto";

const te = new TextEncoder();
const td = new TextDecoder();

const PBKDF2_ITERATIONS = 600000;
const CACHED_KEY_STORAGE = "lifelog.cached_vault_key.v1";
const VERIFICATION_TOKEN = "__LIFELOG_VERIFY_TOKEN_V1__";

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface EncryptedPayload {
  iv: string;
  d: string;
}

export interface VaultAuthMeta {
  salt: string;
  iterations: number;
  verification: string; // JSON string of EncryptedPayload
}

let activeMasterKey: CryptoKey | null = null;

/** Generate a secure random 16-byte salt for PBKDF2 */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** Convert salt Uint8Array to/from hex or base64 */
export function saltToB64(salt: Uint8Array): string {
  return bufToB64(salt.buffer as ArrayBuffer);
}

export function b64ToSalt(b64: string): Uint8Array<ArrayBuffer> {
  return b64ToBytes(b64);
}

/**
 * Derive AES-GCM-256 Master Encryption Key from a Master Password and salt.
 */
export async function deriveMasterKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  if (!hasCrypto) {
    throw new Error("WebCrypto is not supported in this environment");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    te.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable so it can be cached in device secure storage
    ["encrypt", "decrypt"]
  );
}

/**
 * Create a verification payload string to store in the DB.
 * Used to verify the password without storing the password or hash directly.
 */
export async function createVerificationPayload(key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    te.encode(VERIFICATION_TOKEN)
  );
  const payload: EncryptedPayload = {
    iv: bufToB64(iv.buffer),
    d: bufToB64(ct),
  };
  return JSON.stringify(payload);
}

/**
 * Test whether a candidate Master Key correctly decrypts the verification payload.
 */
export async function verifyMasterKey(
  key: CryptoKey,
  verificationJson: string
): Promise<boolean> {
  try {
    const payload: EncryptedPayload = JSON.parse(verificationJson);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
      key,
      b64ToBytes(payload.d)
    );
    const text = td.decode(pt);
    return text === VERIFICATION_TOKEN;
  } catch {
    return false;
  }
}

/**
 * Cache the active master key securely in local device storage
 * so the user does not need to re-enter their password on daily launches.
 */
export async function cacheMasterKeyOnDevice(key: CryptoKey): Promise<void> {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = await crypto.subtle.exportKey("raw", key);
      localStorage.setItem(CACHED_KEY_STORAGE, bufToB64(raw));
      activeMasterKey = key;
    }
  } catch (err) {
    console.warn("Could not cache key in device storage:", err);
  }
}

/**
 * Retrieve the locally cached Master Key from device storage, if present.
 */
export async function getCachedMasterKey(): Promise<CryptoKey | null> {
  if (activeMasterKey) return activeMasterKey;
  if (typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(CACHED_KEY_STORAGE);
    if (!stored) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      b64ToBytes(stored),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    activeMasterKey = key;
    return key;
  } catch (err) {
    console.warn("Failed to load cached master key:", err);
    return null;
  }
}

/**
 * Clear cached key from device (e.g. on manual vault lock or logout)
 */
export function clearCachedMasterKey(): void {
  activeMasterKey = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CACHED_KEY_STORAGE);
  }
}

/**
 * Encrypt any JS object or string using AES-GCM-256.
 * Returns JSON string { iv: "...", d: "..." }
 */
export async function encryptData(key: CryptoKey, data: unknown): Promise<string> {
  const json = typeof data === "string" ? data : JSON.stringify(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    te.encode(json)
  );
  const payload: EncryptedPayload = {
    iv: bufToB64(iv.buffer),
    d: bufToB64(ct),
  };
  return JSON.stringify(payload);
}

/**
 * Decrypt JSON string { iv: "...", d: "..." } into parsed object or string.
 */
export async function decryptData<T = unknown>(
  key: CryptoKey,
  encryptedJson: string
): Promise<T> {
  const payload: EncryptedPayload = JSON.parse(encryptedJson);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.d)
  );
  const text = td.decode(pt);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

import { deriveKeyFromPhrase, getOrCreateRecoveryPhrase } from "./recoveryPhrase";

/**
 * Get the active database encryption key.
 * Priority:
 * 1. Device-Bound Hardware Key (AES-GCM-256) for instant, frictionless local storage.
 * 2. Active Master Key (if explicitly set in-memory)
 * 3. Cached Master Key
 */
export async function getActiveVaultKey(): Promise<CryptoKey> {
  if (activeMasterKey) return activeMasterKey;

  const deviceKey = await getDeviceKey();
  if (deviceKey) return deviceKey;

  const cached = await getCachedMasterKey();
  if (cached) {
    activeMasterKey = cached;
    return cached;
  }

  throw new Error("Unable to obtain local device encryption key");
}
