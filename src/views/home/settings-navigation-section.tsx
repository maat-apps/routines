import { startTransition } from "react";
import { useNavigate } from "react-router";

import { useTranslation } from "@/i18n/use-translation";
import { Button } from "@maat-apps/ui/button";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";

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
