import { createKeyHolder } from "@maat-apps/core/lock";

// The app lock's AES-GCM key, in memory only (@maat-apps/core/lock). The lock
// sets it; storage.ts and app-update.ts encrypt with it whenever it's set.
export const encryptionKey = createKeyHolder();
