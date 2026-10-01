import { deriveKey as deriveKeyWithInfo } from "@maat-apps/core/crypto";

export {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
  randomBytes,
} from "@maat-apps/core/crypto";

// NEVER change this: it's part of how routines-data is encrypted, so a
// different value makes every already-encrypted record undecryptable.
export const HKDF_INFO = "routines-data-v1";

/**
 * Turns a WebAuthn PRF secret into routines' AES-GCM key (see
 * @maat-apps/core/crypto's deriveKey), bound to routines' HKDF info string.
 */
export function deriveKey(
  prfOutput: BufferSource,
  hkdfSalt: BufferSource,
): Promise<CryptoKey> {
  return deriveKeyWithInfo(prfOutput, hkdfSalt, HKDF_INFO);
}
