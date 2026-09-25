import { useEffect, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import {
  disableAppLock,
  enrolAppLock,
  isAppLockSupported,
} from "@/lib/app-lock";
import { SettingsRow, SettingsSection } from "@/views/home/settings-primitives";

export function SecuritySection() {
  const { t } = useTranslation();
  const settings = useAppSettings();
  const [lockSupported, setLockSupported] = useState(false);
  // Kept apart from the panel's shared `status` so it can render against
  // this card rather than at the bottom of the panel.
  const [lockError, setLockError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void isAppLockSupported().then((supported) => {
      if (active) setLockSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggleAppLock(enabled: boolean) {
    setLockError(null);
    if (!enabled) {
      disableAppLock();
      return;
    }
    try {
      await enrolAppLock();
    } catch {
      // Cancelling the platform prompt lands here too; leave the lock off.
      setLockError(t("appLockFailed"));
    }
  }

  return (
    <SettingsSection title={t("sectionSecurity")}>
      <SettingsRow
        title={t("appLock")}
        description={
          lockSupported ? t("appLockDescription") : t("appLockUnsupported")
        }
        action={
          <Switch
            checked={settings.lock !== null}
            disabled={!lockSupported}
            aria-label={t("appLock")}
            onCheckedChange={(checked) => void toggleAppLock(checked)}
          />
        }
      />
      {lockError && (
        <p role="alert" className="text-destructive px-1 text-xs">
          {lockError}
        </p>
      )}
      {settings.lock !== null && (
        <p className="text-muted-foreground px-1 text-xs">
          {settings.lock.encryptionSupported
            ? t("appLockEncryptedNotice")
            : t("appLockNotice")}
        </p>
      )}
    </SettingsSection>
  );
}
