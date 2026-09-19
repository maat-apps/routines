import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useAppSettings } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import {
  disableAppLock,
  enrolAppLock,
  isAppLockSupported,
} from "@/lib/app-lock";
import {
  discardUpdateSnapshot,
  hasNoUpdateSnapshotOnServer,
  hasUpdateSnapshot,
  restoreUpdateSnapshot,
  subscribeToUpdateSnapshot,
  updateApp,
} from "@/lib/app-update";
import {
  applyBackup,
  downloadBackup,
  parseBackup,
  type Backup,
} from "@/lib/backup";
import { resetPreferences } from "@/lib/settings";

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)] gap-2.5"
      aria-label={title}
    >
      {title && (
        <h2 className="text-muted-foreground mt-2 mb-0 px-1 text-xs font-medium tracking-wide uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function SettingsRow({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="bg-card flex min-h-18 items-center justify-between gap-4 rounded-lg border-0 px-4 py-3.5">
      <div className="grid min-w-0 gap-1.5">
        <strong className="font-heading text-lg font-semibold">{title}</strong>
        <span className="text-muted-foreground text-sm">{description}</span>
      </div>
      {/* A flex box, not a block: the controls are inline-flex, so in a block
          wrapper they sit on the text baseline and ride ~4px high. */}
      <div className="flex flex-none items-center">{action}</div>
    </div>
  );
}

function ConfirmDrawer({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Drawer showSwipeHandle open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="group-data-[swipe-axis=y]/drawer-popup:text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button
            className="min-h-12.5 text-base"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            className="min-h-12.5 text-base"
            variant="destructive"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function SettingsPanel() {
  const { t, locale, setLocale } = useTranslation();
  const settings = useAppSettings();
  const install = useInstallPrompt();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lockSupported, setLockSupported] = useState(false);
  // Kept apart from `status` so it can render against the App lock card
  // rather than at the bottom of the panel.
  const [lockError, setLockError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [updating, setUpdating] = useState(false);
  const hasSnapshot = useSyncExternalStore(
    subscribeToUpdateSnapshot,
    hasUpdateSnapshot,
    hasNoUpdateSnapshotOnServer,
  );

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

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch {
      setStatus(t("importFailed"));
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    applyBackup(pendingImport);
    setPendingImport(null);
    setStatus(t("importDone"));
  }

  function confirmResetSettings() {
    resetPreferences();
    // Other stores cache their own snapshots, so a reload is the honest way to
    // land on a clean state.
    window.location.reload();
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <SettingsSection title={t("language")}>
        <SettingsRow
          title={t("language")}
          description={locale === "pl" ? "Polski" : "English"}
          action={
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value as "pl" | "en")}
            >
              <SelectTrigger
                className="h-8.5 w-auto min-w-26 text-sm"
                aria-label={t("language")}
              >
                <SelectValue>
                  {(value) => (value === "en" ? "English" : "Polski")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pl">Polski</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsSection>

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
            {t("appLockNotice")}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title={t("sectionData")}>
        <SettingsRow
          title={t("exportData")}
          description={t("exportDataDescription")}
          action={
            <Button
              variant="outline"
              className="min-h-10.5 px-4"
              onClick={() => downloadBackup()}
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
          accept="application/json,.json"
          className="hidden"
          aria-label={t("importData")}
          onChange={(event) => {
            void onFileChosen(event.target.files?.[0]);
            // Allow re-picking the same file after a failed attempt.
            event.target.value = "";
          }}
        />
      </SettingsSection>

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
                  if (restoreUpdateSnapshot()) {
                    setStatus(t("restoreSnapshotDone"));
                    discardUpdateSnapshot();
                  }
                }}
              >
                {t("restoreSnapshotAction")}
              </Button>
            }
          />
        )}
      </SettingsSection>

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

      <p aria-live="polite" className="text-muted-foreground px-1 text-sm">
        {status}
      </p>

      <ConfirmDrawer
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title={t("importTitle")}
        description={t("importDescription")}
        confirmLabel={t("importConfirm")}
        onConfirm={confirmImport}
      />
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
      <ConfirmDrawer
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t("resetSettingsTitle")}
        description={t("resetSettingsConfirmDescription")}
        confirmLabel={t("resetSettingsAction")}
        onConfirm={confirmResetSettings}
      />
    </div>
  );
}
