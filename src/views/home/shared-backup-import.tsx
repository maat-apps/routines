import { useTranslation } from "@/i18n/use-translation";
import { backups, mergeBackup } from "@/lib/backup";
import { SHARED_BACKUP } from "@/lib/shared-backup";
import { takeSharedBackup } from "@maat-apps/core/share-target";
import { SharedBackupImport as SharedImport } from "@maat-apps/ui/shared-backup-import";

function take() {
  return takeSharedBackup(SHARED_BACKUP);
}

// A backup shared to Routines from another app (lib/shared-backup.ts) lands
// on home with `?shared-backup`; it's imported only after the same
// confirmation as Settings → Import.
export function SharedBackupImport() {
  const { t } = useTranslation();
  return (
    <SharedImport
      take={take}
      parse={backups.parse}
      onImport={mergeBackup}
      labels={{
        importTitle: t("importTitle"),
        importDescription: t("importDescription"),
        importConfirm: t("importConfirm"),
        importFailed: t("importFailed"),
        cancel: t("cancel"),
        done: t("done"),
      }}
    />
  );
}
