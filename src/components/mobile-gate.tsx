import { type ReactNode, useEffect } from "react";

import { useTranslation } from "@/i18n/use-translation";

// Not in lib.dom yet — ScreenOrientation.lock() is non-standard/experimental
// (Android Chrome only), unlike unlock()/angle/type which lib.dom already types.
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

export function MobileGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

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

    // Best-effort only: the Screen Orientation API's lock() only succeeds
    // for a fullscreen or standalone-launched (installed) context on a
    // browser that implements it (Android Chrome) — it silently rejects
    // for a plain browser tab and isn't implemented at all on iOS Safari.
    // A landscape phone opened as a normal tab still sees the "smartphones
    // only" message below; this only helps the installed-PWA case.
    (screen.orientation as LockableScreenOrientation | undefined)
      ?.lock?.("portrait")
      .catch(() => undefined);
  }, []);

  return (
    <>
      <main className="bg-background block min-h-dvh min-[481px]:hidden">
        {children}
      </main>
      <section
        className="bg-background text-muted-foreground hidden min-h-dvh place-items-center p-8 text-center min-[481px]:grid"
        aria-live="polite"
      >
        <p>{t("mobileOnly")}</p>
      </section>
    </>
  );
}
