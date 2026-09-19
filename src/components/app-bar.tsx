import { ArrowLeft } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";

export function AppBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <header className="bg-background sticky top-0 z-10 mb-4 flex h-17 items-center justify-between gap-4 py-2.5">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={t("back")}
        onClick={onBack}
      >
        <ArrowLeft className="size-6" />
      </Button>
      <h1 className="font-heading m-0 min-w-0 flex-1 overflow-hidden text-2xl font-medium tracking-tight text-ellipsis whitespace-nowrap">
        {title}
      </h1>
      {action ?? <span className="w-10" />}
    </header>
  );
}
