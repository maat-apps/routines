import { afterEach } from "vitest";

// jsdom has no IndexedDB implementation, so every test file relying on the
// storage layer needs it faked globally rather than per-file.
import "fake-indexeddb/auto";

// Several storage modules (settings.ts, locale-store.ts, app-lock.ts) write
// to IndexedDB fire-and-forget, on purpose, for UI responsiveness. If a test
// ends (or calls vi.resetModules()) while one of those writes is still
// in-flight, the next test's beforeEach (resetIndexedDb() deleting the
// database) can close the connection out from under it, throwing an
// unhandled InvalidStateError that gets misattributed to whatever test
// happens to be running at that point. A trailing macrotask tick after every
// test gives any such write a chance to settle first.
afterEach(async () => {
  // A first-ever open in a generation also runs onupgradeneeded (and the
  // legacy-localStorage migration inside it), which can take more than one
  // macrotask tick — a plain setTimeout(0) wasn't consistently enough.
  await new Promise((resolve) => setTimeout(resolve, 20));
});
