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

/** A destructive-action confirmation bottom sheet: Cancel + a destructive button. */
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
