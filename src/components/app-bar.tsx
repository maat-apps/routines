import { ArrowLeft } from "lucide-react";
import { type ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
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
    <PageHeader>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={t("back")}
        onClick={onBack}
      >
        <ArrowLeft className="size-6" />
      </Button>
      <h1 className="font-heading m-0 min-w-0 flex-1 overflow-hidden text-2xl font-semibold tracking-tight text-ellipsis whitespace-nowrap">
        {title}
      </h1>
      {action ?? <span className="w-10" />}
    </PageHeader>
  );
}
