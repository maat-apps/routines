import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { useTranslation } from "@/i18n/use-translation";
import { mergeBackup, parseBackup, type Backup } from "@/lib/backup";
import { SHARED_BACKUP_PARAM, takeSharedBackup } from "@/lib/shared-backup";
import { Button } from "@maat-apps/ui/button";
import { ConfirmDrawer } from "@maat-apps/ui/confirm-drawer";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@maat-apps/ui/drawer";

// A backup shared to Routines from another app (lib/shared-backup.ts) lands
// on home with `?shared-backup`; it's imported only after the same
// confirmation as Settings → Import.
export function SharedBackupImport() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const shared = searchParams.has(SHARED_BACKUP_PARAM);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!shared) return;
    // Dropped right away so a reload or Back doesn't ask again.
    setSearchParams({}, { replace: true });
    void takeSharedBackup().then((text) => {
      if (text === null) return;
      try {
        setPendingImport(parseBackup(text));
      } catch {
        setFailed(true);
      }
    });
  }, [shared, setSearchParams]);

  function confirmImport() {
    if (!pendingImport) return;
    mergeBackup(pendingImport);
    setPendingImport(null);
  }

  return (
    <>
      <ConfirmDrawer
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title={t("importTitle")}
        description={t("importDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("importConfirm")}
        onConfirm={confirmImport}
      />
      <Drawer showSwipeHandle open={failed} onOpenChange={setFailed}>
        <DrawerContent>
          <DrawerHeader className="group-data-[swipe-axis=y]/drawer-popup:text-left">
            <DrawerTitle>{t("importFailed")}</DrawerTitle>
          </DrawerHeader>
          <DrawerFooter className="pb-[calc(16px+env(safe-area-inset-bottom))]">
            <Button
              className="min-h-12.5 text-base"
              variant="outline"
              onClick={() => setFailed(false)}
            >
              {t("done")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
