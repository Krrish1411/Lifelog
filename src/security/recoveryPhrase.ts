/* ------------------------------------------------------------------ */
/* 12-Word Mnemonic Recovery Phrase & Key Derivation System           */
/* Standard BIP-39 wordlist based, password-free, human-readable      */
/* ------------------------------------------------------------------ */

import { BIP39_WORDLIST } from "./bip39Wordlist";

const STORAGE_KEY_PHRASE = "lifelog.recovery_phrase.v1";
const PBKDF2_SALT = new TextEncoder().encode("LifeLogVaultKeyV1");
const PBKDF2_ITERATIONS = 100000;

const te = new TextEncoder();

/**
 * Generate a cryptographically secure 12-word recovery phrase.
 */
export function generate12WordPhrase(): string {
  const randomBytes = new Uint32Array(12);
  crypto.getRandomValues(randomBytes);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const index = randomBytes[i] % BIP39_WORDLIST.length;
    words.push(BIP39_WORDLIST[index]);
  }
  return words.join(" ");
}

/**
 * Validate that a phrase consists of 12 valid BIP-39 words.
 */
export function validatePhrase(phrase: string): { valid: boolean; error?: string } {
  const words = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12) {
    return { valid: false, error: `Phrase must contain exactly 12 words (got ${words.length})` };
  }
  const invalidWords = words.filter((w) => !BIP39_WORDLIST.includes(w));
  if (invalidWords.length > 0) {
    return { valid: false, error: `Unrecognized words: ${invalidWords.join(", ")}` };
  }
  return { valid: true };
}

/**
 * Derive 256-bit AES-GCM Master Key from 12-word phrase using PBKDF2-HMAC-SHA256.
 */
export async function deriveKeyFromPhrase(phrase: string): Promise<CryptoKey> {
  const normalized = phrase.trim().toLowerCase().split(/\s+/).join(" ");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    te.encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Get or automatically initialize the device's 12-word recovery phrase.
 */
export function getOrCreateRecoveryPhrase(): string {
  if (typeof localStorage !== "undefined") {
    const existing = localStorage.getItem(STORAGE_KEY_PHRASE);
    if (existing) return existing;
    const newPhrase = generate12WordPhrase();
    localStorage.setItem(STORAGE_KEY_PHRASE, newPhrase);
    return newPhrase;
  }
  return generate12WordPhrase();
}

/**
 * Save / adopt a recovery phrase (e.g. received via P2P sync or entered manually).
 */
export function setRecoveryPhrase(phrase: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PHRASE, phrase.trim().toLowerCase().split(/\s+/).join(" "));
  }
}

/**
 * Clear recovery phrase (used when unpairing/disconnecting secondary device).
 */
export function clearRecoveryPhrase(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_PHRASE);
  }
}
