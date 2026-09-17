import { parseRoutines, parseState } from "@/lib/schemas";
import { DATA_KEY } from "@/lib/storage-keys";
import type { AppData, Routine, RoutineState } from "@/types";

const emptyData: AppData = { routines: [], state: {} };

// --- Central store -----------------------------------------------------------
// localStorage is the single source of truth, but React screens need to react to
// mutations that happen on other screens (e.g. checking a step in the detail view
// should update the counter on the list). We expose a tiny pub/sub with cached
// snapshots so components can subscribe via `useSyncExternalStore`.
const listeners = new Set<() => void>();
const serverRoutines: Routine[] = [];
const serverState: RoutineState = {};

let routinesSnapshot: Routine[] = serverRoutines;
let stateSnapshot: RoutineState = serverState;
let snapshotStale = true;

function refreshSnapshots(): void {
  const normalized = normalizeState(readData());
  routinesSnapshot = withOrderedRoutines(normalized.routines);
  stateSnapshot = normalized.state;
  snapshotStale = false;
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
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readData(): AppData {
  if (typeof window === "undefined") {
    return emptyData;
  }

  try {
    const stored = window.localStorage.getItem(DATA_KEY);
    if (!stored) {
      return emptyData;
    }

    const parsed = JSON.parse(stored) as Partial<AppData>;
    return {
      routines: parseRoutines(parsed.routines),
      state: parseState(parsed.state),
    };
  } catch {
    return emptyData;
  }
}

function writeData(data: AppData): void {
  window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
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

/** Replaces everything — used by backup import and by "reset all data". */
export function replaceAllData(data: AppData): void {
  writeData({
    routines: withOrderedRoutines(data.routines),
    state: data.state,
  });
  emitChange();
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
  emitChange();
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
  emitChange();
}

export function deleteRoutine(routineId: string): void {
  const data = normalizeState(readData());
  const routines = withOrderedRoutines(
    data.routines.filter((routine) => routine.id !== routineId),
  );
  const state = { ...data.state };
  delete state[routineId];
  writeData({ routines, state });
  emitChange();
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
    [routineId]: { checkedStepIds, lastResetDate: today() },
  };

  writeData({ ...data, state });
  emitChange();
  return state;
}

export function resetRoutine(routineId: string): RoutineState {
  const data = normalizeState(readData());
  const state = {
    ...data.state,
    [routineId]: { checkedStepIds: [], lastResetDate: today() },
  };
  writeData({ ...data, state });
  emitChange();
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
  emitChange();
  return state;
}
