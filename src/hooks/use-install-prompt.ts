"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Not in lib.dom yet — Chromium-only, and the whole point of the install button.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  | "unavailable" // No prompt on offer (iOS Safari, or already dismissed).
  | "available"
  | "installed";

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeToDisplayMode(listener: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function isStandalone(): boolean {
  // iOS Safari predates the display-mode media query and sets its own flag.
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    iosNavigator.standalone === true
  );
}

export function getServerStandaloneSnapshot(): boolean {
  return false;
}

export function useInstallPrompt() {
  // Whether we are already running installed is external browser state, so it is
  // read through a store rather than synced into state from an effect.
  const standalone = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandalone,
    getServerStandaloneSnapshot,
  );
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Keep the event so the button can replay it on a real user gesture.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setPrompt(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use whatever the answer.
    setPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  }, [prompt]);

  const state: InstallState =
    standalone || installed
      ? "installed"
      : prompt
        ? "available"
        : "unavailable";

  return { state, install };
}
