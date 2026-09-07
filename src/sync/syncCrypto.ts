import type { EncryptedSyncPacket, SyncMessage } from "./syncTypes";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from a secret passphrase and salt using PBKDF2 with 100,000 iterations.
 */
async function deriveSyncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a SyncMessage object using AES-GCM 256-bit encryption.
 */
export async function encryptSyncMessage(
  msg: SyncMessage,
  sharedSecret: string
): Promise<EncryptedSyncPacket> {
  const enc = new TextEncoder();
  const rawData = enc.encode(JSON.stringify(msg));

  // Generate a cryptographically random 96-bit IV and 128-bit salt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await deriveSyncKey(sharedSecret, salt);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    rawData
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    tagLength: 128,
  };
}

/**
 * Decrypt an EncryptedSyncPacket back into a typed SyncMessage.
 */
export async function decryptSyncMessage(
  packet: EncryptedSyncPacket,
  sharedSecret: string
): Promise<SyncMessage> {
  const iv = new Uint8Array(base64ToArrayBuffer(packet.iv));
  const salt = new Uint8Array(base64ToArrayBuffer(packet.salt));
  const ciphertext = base64ToArrayBuffer(packet.ciphertext);

  const key = await deriveSyncKey(sharedSecret, salt);
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: packet.tagLength || 128,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as SyncMessage;
}
