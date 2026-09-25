import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  applyBackup,
  downloadBackup,
  parseBackup,
  shareBackup,
  type Backup,
} from "@/lib/backup";
import {
  ConfirmDrawer,
  SettingsRow,
  SettingsSection,
} from "@/views/home/settings-primitives";

export function DataSection({
  onStatus,
}: {
  onStatus: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    onStatus(null);
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch {
      onStatus(t("importFailed"));
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    applyBackup(pendingImport);
    setPendingImport(null);
    onStatus(t("importDone"));
  }

  async function onExport() {
    onStatus(null);
    const result = await shareBackup();
    if (result === "shared") {
      onStatus(t("exportShared"));
    } else if (result === "unavailable") {
      downloadBackup();
      onStatus(t("exportDone"));
    }
    // "cancelled" — the user dismissed the share sheet; nothing to report.
  }

  return (
    <>
      <SettingsSection title={t("sectionData")}>
        <SettingsRow
          title={t("exportData")}
          description={t("exportDataDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => void onExport()}
            >
              {t("exportAction")}
            </Button>
          }
        />
        <SettingsRow
          title={t("importData")}
          description={t("importDataDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("importAction")}
            </Button>
          }
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,text/plain,.txt"
          className="hidden"
          aria-label={t("importData")}
          onChange={(event) => {
            void onFileChosen(event.target.files?.[0]);
            // Allow re-picking the same file after a failed attempt.
            event.target.value = "";
          }}
        />
      </SettingsSection>
      <ConfirmDrawer
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title={t("importTitle")}
        description={t("importDescription")}
        confirmLabel={t("importConfirm")}
        onConfirm={confirmImport}
      />
    </>
  );
}
