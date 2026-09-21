import { type ReactNode, useEffect } from "react";

import { useTranslation } from "@/i18n/use-translation";

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
  }, []);

  return (
    <>
      <main className="bg-background phone-sized:block hidden min-h-dvh">
        {children}
      </main>
      <section
        className="bg-background text-muted-foreground phone-sized:hidden grid min-h-dvh place-items-center p-8 text-center"
        aria-live="polite"
      >
        <p>{t("mobileOnly")}</p>
      </section>
    </>
  );
}
