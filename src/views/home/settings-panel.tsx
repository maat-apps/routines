import { useState } from "react";

import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useTranslation } from "@/i18n/use-translation";
import { appLock } from "@/lib/app-lock";
import { backups, mergeBackup } from "@/lib/backup";
import { appSettings } from "@/lib/settings";
import { LayoutSection } from "@/views/home/settings-layout-section";
import { NavigationSection } from "@/views/home/settings-navigation-section";
import { ResetSection } from "@/views/home/settings-reset-section";
import {
  AppSection,
  DataSection,
  LanguageSection,
  SecuritySection,
} from "@maat-apps/ui/settings-sections";

// The language, security, data and app sections are @maat-apps/ui's, as in
// every app; layout, navigation and reset are routines' own.
export function SettingsPanel() {
  const { t, locale, setLocale } = useTranslation();
  const install = useInstallPrompt();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <LanguageSection
        title={t("language")}
        locale={locale}
        languages={{ pl: "Polski", en: "English" }}
        onLocaleChange={setLocale}
      />
      <SecuritySection
        lock={appLock}
        settings={appSettings}
        labels={{
          title: t("sectionSecurity"),
          appLock: t("appLock"),
          appLockDescription: t("appLockDescription"),
          appLockUnsupported: t("appLockUnsupported"),
          appLockFailed: t("appLockFailed"),
          relockAfter: t("relockAfter"),
          relockAfterDescription: t("relockAfterDescription"),
          relockNow: t("relockNow"),
          relock30s: t("relock30s"),
          relockClose: t("relockClose"),
          appLockNotice: t("appLockNotice"),
          appLockEncryptedNotice: t("appLockEncryptedNotice"),
        }}
      />
      <LayoutSection />
      <NavigationSection />
      <DataSection
        backups={backups}
        onImport={mergeBackup}
        onStatus={setStatus}
        labels={{
          title: t("sectionData"),
          exportData: t("exportData"),
          exportDataDescription: t("exportDataDescription"),
          exportAction: t("exportAction"),
          exportShared: t("exportShared"),
          exportDone: t("exportDone"),
          importData: t("importData"),
          importDataDescription: t("importDataDescription"),
          importAction: t("importAction"),
          importFailed: t("importFailed"),
          importTitle: t("importTitle"),
          importDescription: t("importDescription"),
          importConfirm: t("importConfirm"),
          importDone: t("importDone"),
          cancel: t("cancel"),
        }}
      />
      <AppSection
        install={install}
        updateApp={backups.updateApp}
        restore={{
          snapshot: backups.snapshot,
          labels: {
            title: t("restoreSnapshot"),
            description: t("restoreSnapshotDescription"),
            action: t("restoreSnapshotAction"),
            done: t("restoreSnapshotDone"),
          },
        }}
        onStatus={setStatus}
        labels={{
          title: t("sectionApp"),
          installApp: t("installApp"),
          installAppDescription: t("installAppDescription"),
          installAppInstalled: t("installAppInstalled"),
          installAppUnavailable: t("installAppUnavailable"),
          installAppAction: t("installAppAction"),
          updateApp: t("updateApp"),
          updateAppDescription: t("updateAppDescription"),
          updateAppAction: t("updateAppAction"),
          updateAppBusy: t("updateAppBusy"),
          updateConfirmTitle: t("updateAppTitle"),
          updateConfirmDescription: t("updateAppConfirmDescription"),
          cancel: t("cancel"),
        }}
      />
      <ResetSection />
      <p aria-live="polite" className="text-muted-foreground px-1 text-sm">
        {status}
      </p>
    </div>
  );
}
