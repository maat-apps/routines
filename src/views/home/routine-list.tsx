import { ArrowCounterClockwise, Gear, Plus } from "@phosphor-icons/react";
import { startTransition, useEffect, useState } from "react";

import { RoutineRowContent } from "@/components/routine-row-content";
import { useTranslation } from "@/i18n/use-translation";
import type { Routine, RoutineProgress } from "@/types";
import { SettingsPanel } from "@/views/home/settings-panel";
import { Button } from "@maat-apps/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@maat-apps/ui/drawer";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { FabButton } from "@maat-apps/ui/fab-button";
import { PageHeader, PageTitle } from "@maat-apps/ui/page-header";
import { ResetButton } from "@maat-apps/ui/reset-button";
import { SortableList, SortableListRow } from "@maat-apps/ui/sortable-list";

export function RoutineList({
  routines,
  hasAnyRoutines,
  state,
  hasCheckedSteps,
  onCreate,
  onOpen,
  onResetAll,
  onReorder,
}: {
  routines: Routine[];
  hasAnyRoutines: boolean;
  state: Record<string, RoutineProgress>;
  hasCheckedSteps: boolean;
  onCreate: () => void;
  onOpen: (routineId: string) => void;
  onResetAll: () => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const { t, locale } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Computed after mount so a static export's build-time HTML never bakes in a
  // stale date — mirrors the empty-until-mounted pattern storage.ts uses for
  // localStorage reads. Re-read on remount, same as the daily reset in
  // storage.ts's normalizeState, rather than ticking live across midnight.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => startTransition(() => setToday(new Date())), []);
  const todayLabel = today
    ? new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(today)
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col px-5 pt-27 pb-[calc(128px+env(safe-area-inset-bottom))]">
      <PageHeader>
        <div className="min-w-0">
          <PageTitle>{t("appName")}</PageTitle>
          {todayLabel && (
            <p className="text-muted-foreground m-0 mt-2 overflow-hidden text-sm leading-tight text-ellipsis whitespace-nowrap">
              {todayLabel}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={t("settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <Gear className="size-6" />
        </Button>
      </PageHeader>
      {routines.length === 0 ? (
        hasAnyRoutines ? (
          <EmptyState
            title={t("noRoutinesTodayTitle")}
            description={t("noRoutinesTodayDescription")}
          />
        ) : (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={{
              label: (
                <>
                  <Plus /> {t("newRoutine")}
                </>
              ),
              onClick: onCreate,
            }}
          />
        )
      ) : (
        <SortableList
          items={routines}
          onReorder={onReorder}
          className="mt-auto gap-2.5"
          aria-label={t("routinesList")}
          renderItem={(routine) => {
            const checkedCount =
              state[routine.id]?.checkedStepIds.filter((id) =>
                routine.steps.some((step) => step.id === id),
              ).length ?? 0;
            return (
              <SortableListRow
                key={routine.id}
                id={routine.id}
                dragLabel={t("dragRoutine")}
                onOpen={onOpen}
              >
                <RoutineRowContent
                  routine={routine}
                  checkedCount={checkedCount}
                  completedLabel={t("completed")}
                  unnamedLabel={t("unnamed")}
                />
              </SortableListRow>
            );
          }}
        />
      )}
      {routines.length > 0 && (
        <ResetButton
          className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-[max(20px,calc((100vw-480px)/2+20px))] z-20"
          disabled={!hasCheckedSteps}
          onClick={onResetAll}
        >
          <ArrowCounterClockwise aria-hidden="true" />
          {t("resetAll")}
        </ResetButton>
      )}
      <FabButton
        className="fixed right-[max(20px,calc((100vw-480px)/2+20px))] bottom-[calc(20px+env(safe-area-inset-bottom))] z-20"
        ariaLabel={t("newRoutine")}
        onClick={onCreate}
      >
        <Plus className="size-6" />
      </FabButton>
      <Drawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        showSwipeHandle
      >
        <DrawerContent
          // `--popover` and `--card` are the same colour, so on the default
          // drawer surface the settings rows would lose their card edges. The
          // bleed below the drawer has to match, or it shows through on
          // overscroll.
          className="bg-background [--drawer-bleed-background:var(--color-background)]"
        >
          <DrawerHeader className="group-data-[swipe-axis=y]/drawer-popup:text-left">
            <DrawerTitle>{t("settings")}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <SettingsPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
