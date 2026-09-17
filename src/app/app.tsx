import { useEffect } from "react";

import { AppRouter } from "@/app/router";
import { AppLockGate } from "@/components/app-lock-gate";
import { MobileGate } from "@/components/mobile-gate";
import { useRevalidateOnVisibility } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";

export function App() {
  const { locale } = useTranslation();
  useRevalidateOnVisibility();

  // The document starts as <html lang="en">; keep it in sync with the runtime
  // locale after mount so screen readers use the right pronunciation rules
  // once the user switches to Polish.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <MobileGate>
      <AppLockGate>
        <AppRouter />
      </AppLockGate>
    </MobileGate>
  );
}
