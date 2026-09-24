// jsdom has no IndexedDB implementation, so every test file relying on the
// storage layer needs it faked globally rather than per-file.
import "fake-indexeddb/auto";
