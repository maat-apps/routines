import { createAppLock } from "@maat-apps/core/lock";

import { discardUpdateSnapshot } from "@/lib/app-update";
import { encryptionKey } from "@/lib/encryption-key";
import {
  clearLockEnrolment,
  getSettingsSnapshot,
  setLockEnrolment,
} from "@/lib/settings";
import { getRawData, replaceAllData } from "@/lib/storage";
import { HKDF_INFO } from "@/lib/webauthn-crypto";

// routines' app lock (@maat-apps/core/lock): a WebAuthn gate that encrypts
// routines-data when the authenticator supports PRF, a UI gate otherwise.
// The UI says "fingerprint" because that's what the app is used with; the
// OS actually picks how to verify the user.
export const appLock = createAppLock({
  name: "Routines",
  keyInfo: HKDF_INFO,
  keyHolder: encryptionKey,
  enrolment: {
    get: () => getSettingsSnapshot().lock,
    set: (lock) => (lock ? setLockEnrolment(lock) : clearLockEnrolment()),
  },
  data: {
    rewrite: () => replaceAllData(getRawData()),
    erase: async () => {
      replaceAllData({ routines: [], state: {} });
      await discardUpdateSnapshot();
    },
  },
});
