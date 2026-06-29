import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = "test-encryption-passphrase";
});

describe("secret encryption (SEC-002)", () => {
  it("encrypts and decrypts round-trip", () => {
    const secret = "sk-or-v1-abcdef0123456789";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret); // ciphertext does not leak the key
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("masks to only the last 4 characters", () => {
    expect(maskSecret("sk-or-v1-abcd1234")).toBe("••••••••1234");
    expect(maskSecret("ab")).toBe("••");
    expect(maskSecret("")).toBe("");
  });

  it("fails to decrypt tampered ciphertext (auth tag)", () => {
    const enc = encryptSecret("secret");
    const tampered = enc.slice(0, -4) + (enc.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
