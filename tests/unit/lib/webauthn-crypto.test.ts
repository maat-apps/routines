import { describe, expect, it } from "vitest";

import {
  decryptJson,
  deriveKey,
  encryptJson,
  isEncryptedBlob,
  randomBytes,
} from "@/lib/webauthn-crypto";

async function testKey(prfOutput = randomBytes(32), salt = randomBytes(16)) {
  return deriveKey(prfOutput, salt);
}

describe("deriveKey", () => {
  it("derives a usable, non-extractable AES-GCM key", async () => {
    const key = await testKey();
    expect(key.algorithm.name).toBe("AES-GCM");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["encrypt", "decrypt"]);
  });

  it("derives the same key from the same PRF output and salt", async () => {
    const prfOutput = randomBytes(32);
    const salt = randomBytes(16);
    const key = await deriveKey(prfOutput, salt);
    const value = { secret: "same" };
    const blob = await encryptJson(key, value);

    const sameKey = await deriveKey(prfOutput, salt);
    await expect(decryptJson(sameKey, blob)).resolves.toEqual(value);
  });

  it("derives a different key from a different salt", async () => {
    const prfOutput = randomBytes(32);
    const keyA = await deriveKey(prfOutput, randomBytes(16));
    const keyB = await deriveKey(prfOutput, randomBytes(16));
    const blob = await encryptJson(keyA, { secret: "a" });
    await expect(decryptJson(keyB, blob)).rejects.toThrow();
  });
});

describe("encryptJson / decryptJson", () => {
  it("round-trips a JSON value", async () => {
    const key = await testKey();
    const value = { routines: [{ id: "r1", name: "Morning" }], count: 3 };
    const blob = await encryptJson(key, value);
    await expect(decryptJson(key, blob)).resolves.toEqual(value);
  });

  it("produces a different ciphertext each time (fresh IV per call)", async () => {
    const key = await testKey();
    const value = { same: true };
    const first = await encryptJson(key, value);
    const second = await encryptJson(key, value);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("fails to decrypt with the wrong key", async () => {
    const key = await testKey();
    const wrongKey = await testKey();
    const blob = await encryptJson(key, { secret: "value" });
    await expect(decryptJson(wrongKey, blob)).rejects.toThrow();
  });

  it("fails to decrypt a tampered ciphertext", async () => {
    const key = await testKey();
    const blob = await encryptJson(key, { secret: "value" });
    const tampered = {
      ...blob,
      ciphertext: blob.ciphertext.slice(0, -4) + "AAAA",
    };
    await expect(decryptJson(key, tampered)).rejects.toThrow();
  });
});

describe("isEncryptedBlob", () => {
  it("accepts a value shaped like an encrypted blob", () => {
    expect(isEncryptedBlob({ iv: "abc", ciphertext: "def" })).toBe(true);
  });

  it("rejects plain application data", () => {
    expect(isEncryptedBlob({ routines: [], state: {} })).toBe(false);
    expect(isEncryptedBlob(null)).toBe(false);
    expect(isEncryptedBlob("abc")).toBe(false);
    expect(isEncryptedBlob({ iv: "abc" })).toBe(false);
    expect(isEncryptedBlob({ iv: 1, ciphertext: "def" })).toBe(false);
  });
});

describe("randomBytes", () => {
  it("returns the requested length and varies between calls", () => {
    const a = randomBytes(16);
    const b = randomBytes(16);
    expect(a).toHaveLength(16);
    expect(b).toHaveLength(16);
    expect(a).not.toEqual(b);
  });
});
