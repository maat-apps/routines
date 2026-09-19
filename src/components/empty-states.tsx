import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";

const emptyStateClass =
  "grid min-h-[calc(100dvh-72px-60px)] w-full -translate-y-8 content-center justify-items-center gap-4 px-4.5 py-5 text-center";

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={emptyStateClass}>
      <h2 className="font-heading m-0 text-xl">{t("emptyTitle")}</h2>
      <p className="text-muted-foreground mx-0 mt-0 mb-2 max-w-70 text-sm leading-normal">
        {t("emptyDescription")}
      </p>
      <Button onClick={onCreate}>
        <Plus /> {t("newRoutine")}
      </Button>
    </div>
  );
}

// Distinct from EmptyState: the user has routines, just none scheduled for
// today (routine-day-scheduling) — no "create one" prompt, since creating
// wouldn't be the fix.
export function NoRoutinesToday() {
  const { t } = useTranslation();
  return (
    <div className={emptyStateClass}>
      <h2 className="font-heading m-0 text-xl">{t("noRoutinesTodayTitle")}</h2>
      <p className="text-muted-foreground mx-0 mt-0 mb-2 max-w-70 text-sm leading-normal">
        {t("noRoutinesTodayDescription")}
      </p>
    </div>
  );
}

export function EmptySteps({ onEdit }: { onEdit: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={`${emptyStateClass} pt-10`}>
      <p className="text-muted-foreground mx-0 mt-0 mb-2 max-w-70 text-sm leading-normal">
        {t("noSteps")}
      </p>
      <Button variant="outline" onClick={onEdit}>
        <Plus /> {t("addFirstStep")}
      </Button>
    </div>
  );
}
