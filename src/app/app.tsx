import { MobileGate } from "@maat-apps/ui/mobile-gate";
import { useEffect } from "react";

import { AppRouter } from "@/app/router";
import { AppLockGate } from "@/components/app-lock-gate";
import { useRevalidateOnVisibility } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";

export function App() {
  const { locale, t } = useTranslation();
  useRevalidateOnVisibility();

  // The document starts as <html lang="en">; keep it in sync with the runtime
  // locale after mount so screen readers use the right pronunciation rules
  // once the user switches to Polish.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // @maat-apps/ui's MobileGate doesn't register a service worker itself
  // (per-app setup, not part of the gate shape) — this used to live inside
  // routines' own mobile-gate.tsx.
  useEffect(() => {
    // sw.js is only built in production (see vite.config.ts); registering it
    // in dev would also fight Vite's own HMR with a caching service worker.
    // BASE_URL (not a hardcoded "/routines/") so a PR preview built under
    // "/routines/pr-<n>/" registers its own worker scoped to that subpath
    // instead of colliding with main's.
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => undefined);
    }
    // Best-effort request that the browser not evict IndexedDB under storage
    // pressure — cheap insurance now that data lives there. Ignored outright
    // by browsers that don't support it.
    if ("storage" in navigator && "persist" in navigator.storage) {
      navigator.storage.persist().catch(() => undefined);
    }
  }, []);

  return (
    <MobileGate message={t("mobileOnly")}>
      <AppLockGate>
        <AppRouter />
      </AppLockGate>
    </MobileGate>
  );
}
