import { Plus } from "@phosphor-icons/react";
import { startTransition } from "react";
import { useNavigate } from "react-router";

import { RoutineRowContent } from "@/components/routine-row-content";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines, useRoutineState } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { isRoutineActiveToday } from "@/lib/routine-utils";
import { AppBar } from "@maat-apps/ui/app-bar";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { ListRow } from "@maat-apps/ui/list-row";

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
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-27 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <AppBar
        title={t("allRoutinesTitle")}
        backLabel={t("back")}
        onBack={() => startTransition(smartBack)}
      />
      {routines.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={{
            label: (
              <>
                <Plus /> {t("newRoutine")}
              </>
            ),
            onClick: () => startTransition(() => navigate("/new")),
          }}
        />
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
              <ListRow
                key={routine.id}
                onClick={() =>
                  startTransition(() =>
                    navigate(`/${encodeURIComponent(routine.id)}`),
                  )
                }
              >
                <RoutineRowContent
                  routine={routine}
                  checkedCount={checkedCount}
                  completedLabel={t("completed")}
                  unnamedLabel={t("unnamed")}
                  subtitle={
                    !activeToday && (
                      <span className="text-muted-foreground text-xs">
                        {t("notScheduledToday")}
                      </span>
                    )
                  }
                />
              </ListRow>
            );
          })}
        </section>
      )}
    </div>
  );
}
