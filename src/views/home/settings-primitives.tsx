import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useTranslation } from "@/i18n/use-translation";

/** Shared building blocks for the settings sections in this directory. */

export function SettingsSection({
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
        <h2 className="text-muted-foreground mt-2 mb-0 px-1 text-xs font-semibold tracking-wide uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function SettingsRow({
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

export function ConfirmDrawer({
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
