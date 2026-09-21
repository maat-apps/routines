import { startTransition } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";

// Shown by the "/:id" and "/:id/edit" views when the id in
// the URL no longer matches a stored routine (e.g. it was deleted in another tab).
export function MissingRoutine() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-dvh place-items-center gap-4 px-5 text-center">
      <p className="m-0">{t("routineNotFound")}</p>
      <Button size="lg" onClick={() => startTransition(() => navigate("/"))}>
        {t("viewAllRoutines")}
      </Button>
    </div>
  );
}
