import { lockData } from "@maat-apps/core/local";
import { createAppLock } from "@maat-apps/core/lock";

import { backups } from "@/lib/backup";
import { encryptionKey } from "@/lib/encryption-key";
import { appSettings } from "@/lib/settings";
import { dataStore } from "@/lib/storage";
import { HKDF_INFO } from "@/lib/webauthn-crypto";

// routines' app lock (@maat-apps/core/lock): a WebAuthn gate that encrypts
// routines-data when the authenticator supports PRF, a UI gate otherwise.
// The UI says "fingerprint" because that's what the app is used with; the
// OS actually picks how to verify the user.
export const appLock = createAppLock({
  name: "Routines",
  keyInfo: HKDF_INFO,
  keyHolder: encryptionKey,
  relockAfterMs: appSettings.relockAfterMs,
  saveEnrolment: appSettings.setLockEnrolment,
  data: lockData(dataStore, backups.lockPart),
});
