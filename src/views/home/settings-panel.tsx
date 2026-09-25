import { useState } from "react";

import { AppSection } from "@/views/home/settings-app-section";
import { DataSection } from "@/views/home/settings-data-section";
import { LanguageSection } from "@/views/home/settings-language-section";
import { NavigationSection } from "@/views/home/settings-navigation-section";
import { ResetSection } from "@/views/home/settings-reset-section";
import { SecuritySection } from "@/views/home/settings-security-section";

export function SettingsPanel() {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <LanguageSection />
      <SecuritySection />
      <NavigationSection />
      <DataSection onStatus={setStatus} />
      <AppSection onStatus={setStatus} />
      <ResetSection />
      <p aria-live="polite" className="text-muted-foreground px-1 text-sm">
        {status}
      </p>
    </div>
  );
}
