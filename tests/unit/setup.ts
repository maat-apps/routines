import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no IndexedDB implementation, so every test file relying on the
// storage layer needs it faked globally rather than per-file.
import "fake-indexeddb/auto";

// @testing-library/react only auto-registers its own afterEach(cleanup) when
// it finds a *global* `afterEach` (checks `typeof afterEach === "function"`,
// i.e. globalThis.afterEach — see its dist/index.js). This project never
// sets `test.globals: true` and every file imports `afterEach` from "vitest"
// explicitly instead, so that detection always silently failed: components
// rendered with renderHook()/render() were never actually unmounted between
// tests. Left mounted, their event listeners stayed attached to the shared
// `window` (isolate: false reuses one jsdom instance for the whole run) for
// every later test in the file — a later test's dispatchEvent(...) could
// re-trigger a hook instance mounted several tests earlier, one still
// holding a closure over a vi.resetModules()-created settings.ts generation
// whose IndexedDB connection a later resetIndexedDb() had already torn
// down, producing an "unhandled rejection" misattributed to whatever test
// happened to be running when that stale write landed. Calling cleanup()
// explicitly restores the unmount RTL would otherwise have done
// automatically, and removes the leak at its source.
afterEach(async () => {
  cleanup();
  // Several storage modules (settings.ts, locale-store.ts, app-lock.ts)
  // still write to IndexedDB fire-and-forget, on purpose, for UI
  // responsiveness — a trailing macrotask tick after every test gives any
  // such write from *this* test's own generation a chance to settle before
  // the next test's beforeEach (resetIndexedDb()) deletes the database out
  // from under it. A first-ever open in a generation also runs
  // onupgradeneeded (and the legacy-localStorage migration inside it),
  // which can take more than one macrotask tick — a plain setTimeout(0)
  // wasn't consistently enough.
  await new Promise((resolve) => setTimeout(resolve, 20));
});
