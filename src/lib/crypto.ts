// Server-side secret encryption (SEC-002). The OpenRouter API key is encrypted at rest
// with AES-256-GCM using APP_ENCRYPTION_KEY (from Vercel env, SEC-008) and is NEVER
// returned in full — only a masked form is exposed to the UI.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set (SEC-002).");
  // Normalise any passphrase to a 32-byte key.
  return createHash("sha256").update(raw).digest();
}

// Returns base64(iv | authTag | ciphertext).
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// Masked display form — shows only the last 4 characters, never the full secret.
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 4) return "•".repeat(plaintext.length);
  return `${"•".repeat(8)}${plaintext.slice(-4)}`;
}
