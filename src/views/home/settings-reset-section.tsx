import { useState } from "react";

import { ConfirmDrawer } from "@/components/confirm-drawer";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { resetPreferences } from "@/lib/settings";
import { SettingsSection } from "@/views/home/settings-primitives";

export function ResetSection() {
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);

  function confirmResetSettings() {
    void (async () => {
      await resetPreferences();
      // Other stores cache their own snapshots, so a reload is the honest
      // way to land on a clean state.
      window.location.reload();
    })();
  }

  return (
    <>
      <SettingsSection>
        <Button
          variant="destructive"
          className="mt-4 min-h-12.5 w-full text-base"
          onClick={() => setConfirmReset(true)}
        >
          {t("resetSettings")}
        </Button>
        <p className="text-muted-foreground px-1 text-xs">
          {t("resetSettingsDescription")}
        </p>
      </SettingsSection>
      <ConfirmDrawer
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("resetSettingsTitle")}
        description={t("resetSettingsConfirmDescription")}
        confirmLabel={t("resetSettingsAction")}
        onConfirm={confirmResetSettings}
      />
    </>
  );
}
