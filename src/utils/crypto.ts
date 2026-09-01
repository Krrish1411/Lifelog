import type { EncBlob } from "../types";

/* ------------------------------------------------------------------ */
/* Local-only encryption. Nothing ever leaves the device.              */
/*  - App data at rest: AES-256-GCM with a random per-device key.      */
/*  - Backups: AES-256-GCM with a key derived from the user's master   */
/*    password (PBKDF2, 150k iterations, SHA-256).                     */
/* ------------------------------------------------------------------ */

const te = new TextEncoder();
const td = new TextDecoder();

export const hasCrypto: boolean =
  typeof crypto !== "undefined" && !!crypto.subtle;

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

const DEVICE_KEY_LS = "lifelog.devicekey.v1";
let deviceKeyPromise: Promise<CryptoKey | null> | null = null;

/** Random 256-bit key generated once per device, kept in local storage only. */
export function getDeviceKey(): Promise<CryptoKey | null> {
  if (!hasCrypto) return Promise.resolve(null);
  if (!deviceKeyPromise) {
    deviceKeyPromise = (async () => {
      try {
        const stored = localStorage.getItem(DEVICE_KEY_LS);
        if (stored) {
          return await crypto.subtle.importKey(
            "raw",
            b64ToBytes(stored),
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"],
          );
        }
        const key = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
        const raw = await crypto.subtle.exportKey("raw", key);
        localStorage.setItem(DEVICE_KEY_LS, bufToB64(raw));
        return key;
      } catch {
        return null;
      }
    })();
  }
  return deviceKeyPromise;
}

/* ---------- small blobs (notes, per-task private notes) ---------- */
export async function encryptText(key: CryptoKey | null, text: string): Promise<EncBlob> {
  if (!key || !hasCrypto) return { plain: text };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(text));
  return { iv: bufToB64(iv.buffer), d: bufToB64(ct) };
}
export async function decryptText(key: CryptoKey | null, blob: EncBlob | null | undefined): Promise<string> {
  if (!blob) return "";
  if (blob.plain !== undefined || !blob.d || !blob.iv) return blob.plain ?? "";
  if (!key) return "(encrypted — Web Crypto unavailable in this browser)";
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(blob.iv) },
      key,
      b64ToBytes(blob.d),
    );
    return td.decode(pt);
  } catch {
    return "(decryption failed)";
  }
}

/* ---------- whole-state envelope (at rest + plain export) ---------- */
export async function encryptEnvelope(key: CryptoKey | null, obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  if (!key || !hasCrypto) return JSON.stringify({ v: 1, kind: "plain", d: json });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(json));
  return JSON.stringify({ v: 1, kind: "device", iv: bufToB64(iv.buffer), d: bufToB64(ct) });
}
export async function decryptEnvelope<T>(key: CryptoKey | null, payload: string): Promise<T> {
  const env = JSON.parse(payload) as { kind: string; iv?: string; d: string };
  if (env.kind === "plain") return JSON.parse(env.d) as T;
  if (!key) throw new Error("Web Crypto unavailable");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(env.iv ?? "") },
    key,
    b64ToBytes(env.d),
  );
  return JSON.parse(td.decode(pt)) as T;
}

/* ---------- password-protected backups ---------- */
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const mat = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    mat,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptBackup(password: string, obj: unknown): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj)));
  return JSON.stringify({
    v: 1,
    kind: "backup",
    app: "LifeLog",
    salt: bufToB64(salt.buffer),
    iv: bufToB64(iv.buffer),
    d: bufToB64(ct),
  });
}
export async function decryptBackup<T>(password: string, payload: string): Promise<T> {
  const env = JSON.parse(payload) as { kind: string; salt: string; iv: string; d: string };
  if (env.kind === "plain") return JSON.parse(env.d) as T; // plain JSON exports also import
  if (env.kind !== "backup") throw new Error("Not a LifeLog backup file");
  const key = await deriveKey(password, b64ToBytes(env.salt));
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(env.iv) },
      key,
      b64ToBytes(env.d),
    );
    return JSON.parse(td.decode(pt)) as T;
  } catch {
    throw new Error("Wrong password — could not decrypt backup");
  }
}
