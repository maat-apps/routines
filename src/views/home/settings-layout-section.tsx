import { useAppSettings } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { setThumbLayout } from "@/lib/settings";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";
import { Switch } from "@maat-apps/ui/switch";

export function LayoutSection() {
  const { t } = useTranslation();
  const settings = useAppSettings();

  return (
    <SettingsSection>
      <SettingsRow
        title={t("thumbLayout")}
        description={t("thumbLayoutDescription")}
        action={
          <Switch
            checked={settings.thumbLayout}
            aria-label={t("thumbLayout")}
            onCheckedChange={setThumbLayout}
          />
        }
      />
    </SettingsSection>
  );
}
