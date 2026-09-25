import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  GripVertical,
  Plus,
  RotateCcw,
  Settings,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import { EmptyState, NoRoutinesToday } from "@/components/empty-states";
import { FabButton } from "@/components/fab-button";
import { PageHeader } from "@/components/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { ResetButton } from "@/components/reset-button";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useDragSensors } from "@/hooks/use-drag-sensors";
import { useTranslation } from "@/i18n/use-translation";
import type { Routine, RoutineProgress } from "@/types";
import { SettingsPanel } from "@/views/home/settings-panel";

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
  const sensors = useDragSensors();

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = routines.findIndex((routine) => routine.id === active.id);
    const newIndex = routines.findIndex((routine) => routine.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(routines, oldIndex, newIndex).map((r) => r.id));
  }

  return (
    <div className="mx-auto flex min-h-dvh w-[min(100%,480px)] flex-col px-5 pt-27 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <PageHeader>
        <div className="min-w-0">
          <h1 className="font-heading m-0 text-3xl leading-[1.05] font-bold tracking-tight">
            {t("appName")}
          </h1>
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
          <Settings className="size-6" />
        </Button>
      </PageHeader>
      {routines.length === 0 ? (
        hasAnyRoutines ? (
          <NoRoutinesToday />
        ) : (
          <EmptyState onCreate={onCreate} />
        )
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={routines.map((routine) => routine.id)}
            strategy={verticalListSortingStrategy}
          >
            <section
              className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-2.5"
              aria-label={t("routinesList")}
            >
              {routines.map((routine) => {
                const checkedCount =
                  state[routine.id]?.checkedStepIds.filter((id) =>
                    routine.steps.some((step) => step.id === id),
                  ).length ?? 0;
                return (
                  <SortableRoutineRow
                    key={routine.id}
                    routine={routine}
                    checkedCount={checkedCount}
                    completedLabel={t("completed")}
                    unnamedLabel={t("unnamed")}
                    dragLabel={t("dragRoutine")}
                    onOpen={onOpen}
                  />
                );
              })}
            </section>
          </SortableContext>
        </DndContext>
      )}
      {routines.length > 0 && (
        <ResetButton
          className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-[max(20px,calc((100vw-480px)/2+20px))] z-20"
          disabled={!hasCheckedSteps}
          onClick={onResetAll}
        >
          <RotateCcw aria-hidden="true" />
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

function SortableRoutineRow({
  routine,
  checkedCount,
  completedLabel,
  unnamedLabel,
  dragLabel,
  onOpen,
}: {
  routine: Routine;
  checkedCount: number;
  completedLabel: string;
  unnamedLabel: string;
  dragLabel: string;
  onOpen: (routineId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: routine.id });

  return (
    <div
      className={`bg-card text-card-foreground has-[[data-main]:active]:bg-muted flex min-h-18 w-full items-center gap-0 rounded-lg py-0 pr-4 pl-2 text-left transition-colors ${
        isDragging ? "relative z-1 shadow-[0_8px_20px_oklch(0_0_0/20%)]" : ""
      }`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        className="text-muted-foreground flex-none cursor-grab touch-none active:cursor-grabbing"
        variant="ghost"
        size="icon-sm"
        aria-label={dragLabel}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <button
        data-main="true"
        className="[&>svg]:text-muted-foreground flex min-h-18 min-w-0 flex-1 items-center gap-3.5 rounded-lg border-0 bg-transparent py-3.5 pr-0 pl-2 text-left text-inherit"
        onClick={() => onOpen(routine.id)}
      >
        <ProgressRing
          compact
          completed={checkedCount}
          total={routine.steps.length}
          ariaLabel={`${checkedCount} / ${routine.steps.length} ${completedLabel}`}
        />
        <span className="grid min-w-0 flex-1 gap-1.5">
          <strong className="font-heading overflow-hidden text-lg font-semibold text-ellipsis whitespace-nowrap">
            {routine.name || unnamedLabel}
          </strong>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
