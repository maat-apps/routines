import { startTransition } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { SettingsRow, SettingsSection } from "@/views/home/settings-primitives";

export function NavigationSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <SettingsSection>
      <SettingsRow
        title={t("viewAllRoutines")}
        description={t("allRoutinesDescription")}
        action={
          <Button
            variant="outline"
            className="min-h-10.5 px-4"
            onClick={() => startTransition(() => navigate("/all-routines"))}
          >
            {t("viewAllRoutinesAction")}
          </Button>
        }
      />
    </SettingsSection>
  );
}
