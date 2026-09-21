import { ChevronRight } from "lucide-react";
import { startTransition } from "react";
import { useNavigate } from "react-router";

import { AppBar } from "@/components/app-bar";
import { EmptyState } from "@/components/empty-states";
import { ProgressRing } from "@/components/progress-ring";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines, useRoutineState } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { isRoutineActiveToday } from "@/lib/routine-utils";

// A lookup/access point for a routine home.tsx's own today-only filter hides
// (routine-day-scheduling) — not a second home screen, so it deliberately
// doesn't duplicate home's checklist/reset UI, just enough to find and open
// one. Reached from Settings only (settings-panel.tsx), not a second nav
// affordance on home, per the minimalism principle.
export function AllRoutinesView() {
  const navigate = useNavigate();
  const smartBack = useSmartBack("/");
  const { t } = useTranslation();
  const routines = useRoutines();
  const state = useRoutineState();

  return (
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <AppBar
        title={t("allRoutinesTitle")}
        onBack={() => startTransition(smartBack)}
      />
      {routines.length === 0 ? (
        <EmptyState onCreate={() => startTransition(() => navigate("/new"))} />
      ) : (
        <section
          className="grid grid-cols-[minmax(0,1fr)] gap-2.5"
          aria-label={t("allRoutinesTitle")}
        >
          {routines.map((routine) => {
            const checkedCount =
              state[routine.id]?.checkedStepIds.filter((id) =>
                routine.steps.some((step) => step.id === id),
              ).length ?? 0;
            const activeToday = isRoutineActiveToday(routine);
            return (
              <button
                key={routine.id}
                type="button"
                className="bg-card text-card-foreground active:bg-muted [&>svg]:text-muted-foreground flex min-h-18 w-full items-center gap-3.5 rounded-lg border-0 py-3.5 pr-4 pl-4 text-left transition-colors"
                onClick={() =>
                  startTransition(() =>
                    navigate(`/${encodeURIComponent(routine.id)}`),
                  )
                }
              >
                <ProgressRing
                  compact
                  completed={checkedCount}
                  total={routine.steps.length}
                  ariaLabel={`${checkedCount} / ${routine.steps.length} ${t("completed")}`}
                />
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <strong className="font-heading overflow-hidden text-lg font-semibold text-ellipsis whitespace-nowrap">
                    {routine.name || t("unnamed")}
                  </strong>
                  {!activeToday && (
                    <span className="text-muted-foreground text-xs">
                      {t("notScheduledToday")}
                    </span>
                  )}
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
