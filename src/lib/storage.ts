import { createLocalStore } from "@maat-apps/core/local";
import { isRecord } from "@maat-apps/core/validation";

import { encryptionKey } from "@/lib/encryption-key";
import { keyValueStore } from "@/lib/idb-store";
import { formatDateStamp, mergeAppData } from "@/lib/routine-utils";
import { parseRoutines, parseState } from "@/lib/schemas";
import {
  getSettingsSnapshot,
  whenLoaded as whenSettingsLoaded,
} from "@/lib/settings";
import { DATA_KEY } from "@/lib/storage-keys";
import type { AppData, Routine, RoutineDeck, RoutineState } from "@/types";

const emptyData: AppData = { routines: [], state: {} };

// --- Central store -----------------------------------------------------------
// `AppData` lives in @maat-apps/core/local's store: in memory once loaded,
// IndexedDB the write-through backing store, encrypted with the lock's key
// (maat-core's docs/storage.md). On top of it, this module derives the
// snapshots screens read — routines in order, today's state after the daily
// reset — and exposes them through a tiny pub/sub for useSyncExternalStore,
// so a mutation on one screen (checking a step) updates another (the list).

/** Whether the enrolled lock encrypts — then the first read waits for its key. */
async function lockEncrypts(): Promise<boolean> {
  await whenSettingsLoaded();
  return getSettingsSnapshot().lock?.encryptionSupported === true;
}

export const dataStore = createLocalStore<AppData>({
  storage: keyValueStore,
  key: DATA_KEY,
  empty: emptyData,
  parse: (stored) =>
    isRecord(stored)
      ? {
          routines: parseRoutines(stored.routines),
          state: parseState(stored.state),
        }
      : emptyData,
  encryption: { keyHolder: encryptionKey, encrypts: lockEncrypts },
});

const listeners = new Set<() => void>();
const serverRoutines: Routine[] = [];
const serverState: RoutineState = {};

let routinesSnapshot: Routine[] = serverRoutines;
let stateSnapshot: RoutineState = serverState;
let snapshotStale = true;

// The daily reset writes while a snapshot is being derived; that write
// mustn't notify listeners mid-read.
let refreshing = false;
dataStore.subscribe(() => {
  if (!refreshing) emitChange();
});

/**
 * Resolves once the initial background read from IndexedDB has finished.
 * Real screens never need this (they just re-render on the change it fires)
 * — it exists so tests can await readiness deterministically instead of
 * polling.
 */
export function whenLoaded(): Promise<void> {
  return dataStore.whenLoaded();
}

function refreshSnapshots(): void {
  refreshing = true;
  try {
    const normalized = normalizeState(readData());
    routinesSnapshot = withOrderedRoutines(normalized.routines);
    stateSnapshot = normalized.state;
    snapshotStale = false;
  } finally {
    refreshing = false;
  }
}

export function emitChange(): void {
  snapshotStale = true;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRoutinesSnapshot(): Routine[] {
  if (snapshotStale) {
    refreshSnapshots();
  }
  return routinesSnapshot;
}

export function getStateSnapshot(): RoutineState {
  if (snapshotStale) {
    refreshSnapshots();
  }
  return stateSnapshot;
}

export function getServerRoutinesSnapshot(): Routine[] {
  return serverRoutines;
}

export function getServerStateSnapshot(): RoutineState {
  return serverState;
}

function today(): string {
  return formatDateStamp(new Date());
}

function readData(): AppData {
  if (typeof window === "undefined") {
    return emptyData;
  }
  return dataStore.getSnapshot();
}

function writeData(data: AppData): void {
  void dataStore.replace(data);
}

function normalizeState(data: AppData): AppData {
  const currentDate = today();
  let changed = false;
  const state: RoutineState = { ...data.state };

  for (const routine of data.routines) {
    const routineState = state[routine.id];
    if (!routineState || routineState.lastResetDate !== currentDate) {
      state[routine.id] = { checkedStepIds: [], lastResetDate: currentDate };
      changed = true;
    }
  }

  const normalized = { routines: data.routines, state };
  if (changed) {
    writeData(normalized);
  }

  return normalized;
}

function withOrderedRoutines(routines: Routine[]): Routine[] {
  return routines
    .map((routine, index) => ({ ...routine, order: index }))
    .sort((left, right) => left.order - right.order);
}

/** Reads the stored blob as-is, without applying the daily reset. */
export function getRawData(): AppData {
  return readData();
}

/** Adds the routines the device lacks; the ones it has stay as they are. */
export function mergeIntoData(incoming: AppData): void {
  const merged = mergeAppData(readData(), incoming);
  writeData({
    routines: withOrderedRoutines(merged.routines),
    state: merged.state,
  });
}

export function saveRoutine(routine: Routine): void {
  const data = normalizeState(readData());
  const existingIndex = data.routines.findIndex(
    (item) => item.id === routine.id,
  );
  const routines = [...data.routines];

  if (existingIndex === -1) {
    routines.push({ ...routine, order: routines.length });
  } else {
    routines[existingIndex] = routine;
  }

  writeData({ ...data, routines: withOrderedRoutines(routines) });
}

export function reorderRoutines(orderedIds: string[]): void {
  const data = normalizeState(readData());
  const byId = new Map(data.routines.map((routine) => [routine.id, routine]));
  const reordered: Routine[] = [];

  for (const id of orderedIds) {
    const routine = byId.get(id);
    if (routine) {
      reordered.push(routine);
      byId.delete(id);
    }
  }
  // Preserve any routines not present in orderedIds (defensive) in their
  // original relative order.
  for (const routine of data.routines) {
    if (byId.has(routine.id)) {
      reordered.push(routine);
    }
  }

  writeData({ ...data, routines: withOrderedRoutines(reordered) });
}

export function deleteRoutine(routineId: string): void {
  const data = normalizeState(readData());
  const routines = withOrderedRoutines(
    data.routines.filter((routine) => routine.id !== routineId),
  );
  const state = { ...data.state };
  delete state[routineId];
  writeData({ routines, state });
}

export function toggleStep(routineId: string, stepId: string): RoutineState {
  const data = normalizeState(readData());
  const routineState = data.state[routineId] ?? {
    checkedStepIds: [],
    lastResetDate: today(),
  };
  const isChecked = routineState.checkedStepIds.includes(stepId);
  const checkedStepIds = isChecked
    ? routineState.checkedStepIds.filter((id) => id !== stepId)
    : [...routineState.checkedStepIds, stepId];
  const state = {
    ...data.state,
    [routineId]: { ...routineState, checkedStepIds, lastResetDate: today() },
  };

  writeData({ ...data, state });
  return state;
}

/** Saves the card deck's order and undo history; a no-op for an unknown routine. */
export function setDeck(routineId: string, deck: RoutineDeck): void {
  const data = normalizeState(readData());
  const routineState = data.state[routineId];
  if (!routineState) return;
  const state = { ...data.state, [routineId]: { ...routineState, deck } };
  writeData({ ...data, state });
}

export function resetRoutine(routineId: string): RoutineState {
  const data = normalizeState(readData());
  const state = {
    ...data.state,
    [routineId]: { checkedStepIds: [], lastResetDate: today() },
  };
  writeData({ ...data, state });
  return state;
}

export function resetAll(): RoutineState {
  const data = normalizeState(readData());
  const currentDate = today();
  const state = Object.fromEntries(
    data.routines.map((routine) => [
      routine.id,
      { checkedStepIds: [], lastResetDate: currentDate },
    ]),
  );
  writeData({ ...data, state });
  return state;
}
