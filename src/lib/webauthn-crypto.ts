// Derives an AES-GCM key from a WebAuthn PRF secret and encrypts/decrypts
// JSON values with it. No storage or WebAuthn-ceremony knowledge lives here
// — app-lock.ts owns getting the PRF secret out of the authenticator; this
// module only turns that secret into a usable key and uses it.

const HKDF_INFO = new TextEncoder().encode("routines-data-v1");

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Turns a WebAuthn PRF secret into a non-extractable AES-GCM key. The salt
 * is per-enrolment (stored alongside the credential, not secret itself —
 * its job is domain separation, not secrecy) so the same PRF output always
 * derives the same key.
 */
export async function deriveKey(
  prfOutput: BufferSource,
  hkdfSalt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: hkdfSalt,
      info: HKDF_INFO,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

/** A fresh random IV per call — required, since AES-GCM must never reuse an IV under the same key. */
export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** True for a value shaped like something `encryptJson` produced. */
export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as EncryptedBlob).iv === "string" &&
    typeof (value as EncryptedBlob).ciphertext === "string"
  );
}
