import { useState, useSyncExternalStore } from "react";

import { ConfirmDrawer } from "@/components/confirm-drawer";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useTranslation } from "@/i18n/use-translation";
import {
  discardUpdateSnapshot,
  hasNoUpdateSnapshotOnServer,
  hasUpdateSnapshot,
  restoreUpdateSnapshot,
  subscribeToUpdateSnapshot,
  updateApp,
} from "@/lib/app-update";
import { SettingsRow, SettingsSection } from "@/views/home/settings-primitives";

export function AppSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const hasSnapshot = useSyncExternalStore(
    subscribeToUpdateSnapshot,
    hasUpdateSnapshot,
    hasNoUpdateSnapshotOnServer,
  );

  return (
    <>
      <SettingsSection title={t("sectionApp")}>
        <SettingsRow
          title={t("installApp")}
          description={
            install.state === "installed"
              ? t("installAppInstalled")
              : install.state === "available"
                ? t("installAppDescription")
                : t("installAppUnavailable")
          }
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={install.state !== "available"}
              onClick={() => void install.install()}
            >
              {t("installAppAction")}
            </Button>
          }
        />
        <SettingsRow
          title={t("updateApp")}
          description={t("updateAppDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              disabled={updating}
              onClick={() => setConfirmUpdate(true)}
            >
              {updating ? t("updateAppBusy") : t("updateAppAction")}
            </Button>
          }
        />
        {hasSnapshot && (
          <SettingsRow
            title={t("restoreSnapshot")}
            description={t("restoreSnapshotDescription")}
            action={
              <Button
                variant="outline"
                className="min-h-10.5 px-4"
                onClick={() => {
                  void (async () => {
                    if (await restoreUpdateSnapshot()) {
                      onStatus(t("restoreSnapshotDone"));
                      await discardUpdateSnapshot();
                    }
                  })();
                }}
              >
                {t("restoreSnapshotAction")}
              </Button>
            }
          />
        )}
      </SettingsSection>
      <ConfirmDrawer
        open={confirmUpdate}
        onOpenChange={setConfirmUpdate}
        title={t("updateAppTitle")}
        description={t("updateAppConfirmDescription")}
        confirmLabel={t("updateAppAction")}
        onConfirm={() => {
          setConfirmUpdate(false);
          setUpdating(true);
          void updateApp();
        }}
      />
    </>
  );
}
