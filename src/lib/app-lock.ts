import {
  discardUpdateSnapshot,
  setEncryptionKey as setUpdateEncryptionKey,
} from "@/lib/app-update";
import {
  clearLockEnrolment,
  setLockEnrolment,
  type LockEnrolment,
} from "@/lib/settings";
import {
  getRawData,
  replaceAllData,
  setEncryptionKey as setStorageEncryptionKey,
} from "@/lib/storage";
import { deriveKey, randomBytes } from "@/lib/webauthn-crypto";

// The app lock is a convenience gate by default. On a device that supports
// the WebAuthn PRF extension (LockEnrolment.encryptionSupported), it becomes
// real encryption: an AES-GCM key is derived from the credential's PRF
// output and handed to storage.ts/app-update.ts, which encrypt everything
// they persist. On a device without PRF support, this stays exactly what it
// was before — a UI gate with no cryptographic backing, and the settings
// screen says so in as many words.
//
// WebAuthn cannot request a specific biometric. `userVerification: "required"
// asks the platform to verify the user and the OS picks how — fingerprint,
// face, PIN or pattern. The UI says "fingerprint" because that is what this
// app is used with; there is no API to enforce it.

const RP_NAME = "Routines";
const USER_NAME = "Routines";

// Whether this session has already passed the lock. In memory only, so
// closing the app locks it again. Enrolling counts as passing: the user just
// completed the very same platform prompt.
let sessionUnlocked = false;
const unlockListeners = new Set<() => void>();

export function subscribeToUnlock(listener: () => void): () => void {
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

export function isSessionUnlocked(): boolean {
  return sessionUnlocked;
}

export function isLockedOnServer(): boolean {
  return false;
}

function markSessionUnlocked(): void {
  sessionUnlocked = true;
  for (const listener of unlockListeners) {
    listener();
  }
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// WebAuthn wants a `BufferSource` backed by a plain ArrayBuffer, so both helpers
// below pin the element type rather than returning `ArrayBufferLike`.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Hands the derived key (or `null`) to every module that encrypts with it. */
function applyEncryptionKey(key: CryptoKey | null): void {
  setStorageEncryptionKey(key);
  setUpdateEncryptionKey(key);
}

/** True when this browser has a built-in authenticator it can prompt for. */
export async function isAppLockSupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof window.PublicKeyCredential === "undefined"
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a platform credential and stores its handle. Resolves to the
 * enrolment on success; throws if the user cancels or the platform refuses.
 *
 * PRF can only be *requested* at creation — the authenticator only ever
 * returns the actual secret from a `get()` call, so a device that supports
 * PRF needs a second (typically same-gesture) prompt right after this one
 * to derive the key immediately, rather than leaving data unencrypted until
 * the next unlock.
 */
export async function enrolAppLock(): Promise<LockEnrolment> {
  const userId = randomBytes(16);
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: RP_NAME },
      user: { id: userId, name: USER_NAME, displayName: RP_NAME },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
      extensions: { prf: {} },
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("The device did not return a credential.");
  }

  const prfEnabled =
    credential.getClientExtensionResults().prf?.enabled === true;

  let encryptionSupported = false;
  let prfSalt: string | undefined;

  if (prfEnabled) {
    const salt = randomBytes(32);
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: credential.rawId }],
        userVerification: "required",
        timeout: 60_000,
        extensions: { prf: { eval: { first: salt } } },
      },
    })) as PublicKeyCredential | null;

    const prfResult =
      assertion?.getClientExtensionResults().prf?.results?.first;

    if (prfResult) {
      const key = await deriveKey(prfResult, salt);
      applyEncryptionKey(key);
      encryptionSupported = true;
      prfSalt = toBase64Url(salt.buffer);
    }
  }

  const enrolment: LockEnrolment = {
    credentialId: toBase64Url(credential.rawId),
    userId: toBase64Url(userId.buffer),
    createdAt: new Date().toISOString(),
    encryptionSupported,
    prfSalt,
  };
  setLockEnrolment(enrolment);
  markSessionUnlocked();

  if (encryptionSupported) {
    // Any data written before this enrolment is still plaintext in
    // IndexedDB — force an immediate encrypted re-save instead of waiting
    // for the next unrelated edit.
    replaceAllData(getRawData());
  }

  return enrolment;
}

/**
 * Prompts for the platform authenticator. Resolves true when the user passed
 * the check, false when they cancelled or the credential is gone.
 *
 * Unlike enrolment, PRF eval can ride along in the same `get()` call used
 * for the assertion itself — one prompt covers both passing the lock and
 * deriving the key.
 */
export async function verifyAppLock(
  enrolment: LockEnrolment,
): Promise<boolean> {
  try {
    const needsKey = enrolment.encryptionSupported && enrolment.prfSalt != null;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [
          {
            type: "public-key",
            id: fromBase64Url(enrolment.credentialId),
          },
        ],
        userVerification: "required",
        timeout: 60_000,
        ...(needsKey && {
          extensions: {
            prf: { eval: { first: fromBase64Url(enrolment.prfSalt!) } },
          },
        }),
      },
    });
    if (assertion === null) return false;

    if (needsKey) {
      const prfResult =
        assertion.getClientExtensionResults().prf?.results?.first;
      // Without the key the data can never be decrypted, so a "pass" here
      // with no key would just strand the user in a broken unlocked state —
      // treat it the same as a failed verification instead.
      if (!prfResult) return false;
      const key = await deriveKey(prfResult, fromBase64Url(enrolment.prfSalt!));
      applyEncryptionKey(key);
    }

    markSessionUnlocked();
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns the lock off from a state where it's already unlocked (the derived
 * key, if any, is in memory) — fully recoverable. Existing encrypted data
 * simply stops being encrypted from the next write on; nothing is erased.
 */
export function disableAppLock(): void {
  clearLockEnrolment();
  applyEncryptionKey(null);
  // Flush the already-decrypted in-memory data back as plaintext immediately,
  // rather than leaving stale ciphertext behind until the next unrelated edit.
  replaceAllData(getRawData());
  markSessionUnlocked();
}

/**
 * The escape hatch shown when the authenticator fails or is gone — there is
 * no key in this state, so any encrypted data is unreadable garbage. This
 * cannot recover it: it clears the enrolment and wipes routine data (and the
 * update snapshot) so the app comes back to a clean, usable state instead of
 * carrying orphaned ciphertext forever. `app-lock-gate.tsx` is responsible
 * for warning the user before calling this — this function does not ask.
 */
export function disableAppLockAndEraseData(): void {
  clearLockEnrolment();
  applyEncryptionKey(null);
  replaceAllData({ routines: [], state: {} });
  void discardUpdateSnapshot();
  markSessionUnlocked();
}
