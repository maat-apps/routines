"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  isSettingsReady,
  isSettingsReadyOnServer,
  subscribeToSettings,
  subscribeToSettingsReady,
  type AppSettings,
} from "@/lib/settings";
import {
  emitChange,
  getRoutinesSnapshot,
  getServerRoutinesSnapshot,
  getServerStateSnapshot,
  getStateSnapshot,
  subscribe,
} from "@/lib/storage";
import type { Routine, RoutineState } from "@/types";

export function useRoutines(): Routine[] {
  return useSyncExternalStore(
    subscribe,
    getRoutinesSnapshot,
    getServerRoutinesSnapshot,
  );
}

export function useRoutineState(): RoutineState {
  return useSyncExternalStore(
    subscribe,
    getStateSnapshot,
    getServerStateSnapshot,
  );
}

export function useAppSettings(): AppSettings {
  return useSyncExternalStore(
    subscribeToSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot,
  );
}

// Settings load from IndexedDB in the background, so "not loaded yet" and
// "loaded, no lock enrolled" are different states — AppLockGate must not
// treat the former as the latter, or a locked device would briefly show
// unlocked content on every cold start.
export function useSettingsReady(): boolean {
  return useSyncExternalStore(
    subscribeToSettingsReady,
    isSettingsReady,
    isSettingsReadyOnServer,
  );
}

// The cached snapshot only recomputes on the next `emitChange()` (a write from
// this tab), so a routine left open across midnight keeps showing yesterday's
// checked steps until something else happens to trigger it. Re-checking on
// visibility/focus catches the common case (backgrounding overnight, coming
// back the next morning) without a ticking clock.
export function useRevalidateOnVisibility(): void {
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState === "visible") {
        emitChange();
      }
    }
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, []);
}
