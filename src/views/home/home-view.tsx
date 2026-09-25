import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { ConfirmDrawer } from "@/components/confirm-drawer";
import { useRoutines, useRoutineState } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { prefetchRouteChunks } from "@/lib/prefetch-routes";
import { isRoutineActiveToday } from "@/lib/routine-utils";
import { reorderRoutines, resetAll } from "@/lib/storage";
import { RoutineList } from "@/views/home/routine-list";

export function HomeView() {
  const navigate = useNavigate();
  const routines = useRoutines();
  const state = useRoutineState();
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const { t } = useTranslation();
  // "Reset all" and its enabled state cover every routine, scheduled for
  // today or not — only what's rendered in the list itself is scoped to
  // today, per routine-day-scheduling.
  const hasCheckedSteps = routines.some((routine) => {
    const checkedStepIds = state[routine.id]?.checkedStepIds ?? [];
    return routine.steps.some((step) => checkedStepIds.includes(step.id));
  });
  const todaysRoutines = routines.filter((routine) =>
    isRoutineActiveToday(routine),
  );

  // The home view is where every session starts, so "the user is looking at
  // their routine list" is a strong signal they're about to open one — warm
  // the other route chunks once this screen has had its own idle time.
  useEffect(() => prefetchRouteChunks(), []);

  function openNewRoutine() {
    startTransition(() => navigate("/new"));
  }

  function handleResetAll() {
    resetAll();
    setResetAllOpen(false);
  }

  return (
    <>
      <RoutineList
        routines={todaysRoutines}
        hasAnyRoutines={routines.length > 0}
        state={state}
        hasCheckedSteps={hasCheckedSteps}
        onCreate={openNewRoutine}
        onOpen={(routineId) =>
          startTransition(() => navigate(`/${encodeURIComponent(routineId)}`))
        }
        onResetAll={() => setResetAllOpen(true)}
        onReorder={reorderRoutines}
      />
      <ConfirmDrawer
        open={resetAllOpen}
        onOpenChange={setResetAllOpen}
        title={t("resetAllTitle")}
        description={t("resetAllDescription")}
        confirmLabel={t("reset")}
        onConfirm={handleResetAll}
      />
    </>
  );
}
