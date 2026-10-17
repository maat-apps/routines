import { useAppSettings } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { setThumbLayout } from "@/lib/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maat-apps/ui/select";
import {
  SettingsRow,
  SettingsSection,
} from "@maat-apps/ui/settings-primitives";

export function LayoutSection() {
  const { t } = useTranslation();
  const { thumbLayout } = useAppSettings();

  return (
    <SettingsSection>
      <SettingsRow
        title={t("stepLayout")}
        description={
          thumbLayout
            ? t("stepLayoutDeckDescription")
            : t("stepLayoutListDescription")
        }
        action={
          <Select
            value={thumbLayout ? "deck" : "list"}
            onValueChange={(value) => setThumbLayout(value === "deck")}
          >
            <SelectTrigger
              className="w-auto min-w-26 text-sm"
              aria-label={t("stepLayout")}
            >
              <SelectValue>
                {(value) =>
                  value === "deck" ? t("stepLayoutDeck") : t("stepLayoutList")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">{t("stepLayoutList")}</SelectItem>
              <SelectItem value="deck">{t("stepLayoutDeck")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </SettingsSection>
  );
}
