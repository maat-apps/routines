import { Pencil } from "lucide-react";

import { AppBar } from "@/components/app-bar";
import { EmptySteps } from "@/components/empty-states";
import { ProgressRing } from "@/components/progress-ring";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/i18n/use-translation";
import { sortSteps } from "@/lib/routine-utils";
import type { Routine, RoutineProgress } from "@/types";

export function RoutineDetail({
  routine,
  progress,
  onBack,
  onEdit,
  onToggle,
  onReset,
}: {
  routine: Routine;
  progress?: RoutineProgress;
  onBack: () => void;
  onEdit: () => void;
  onToggle: (routineId: string, stepId: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const checkedStepIds = progress?.checkedStepIds ?? [];
  const completed = checkedStepIds.filter((id) =>
    routine.steps.some((step) => step.id === id),
  ).length;

  return (
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-5 pb-[calc(116px+env(safe-area-inset-bottom))]">
      <AppBar
        title={routine.name || t("unnamed")}
        onBack={onBack}
        action={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("editRoutine")}
            onClick={onEdit}
          >
            <Pencil className="size-6" />
          </Button>
        }
      />
      {routine.steps.length === 0 ? (
        <EmptySteps onEdit={onEdit} />
      ) : (
        <section
          className="grid grid-cols-[minmax(0,1fr)]"
          aria-label={t("routineSteps")}
        >
          {sortSteps(routine.steps).map((step) => {
            const checked = checkedStepIds.includes(step.id);
            return (
              <div
                className="border-border text-card-foreground active:bg-muted flex cursor-pointer items-start gap-3.5 border-b px-2.5 py-4.5 text-left transition-colors"
                key={step.id}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onClick={() => onToggle(routine.id, step.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle(routine.id, step.id);
                  }
                }}
              >
                <Checkbox
                  className="mt-1 size-5.5 shrink-0 rounded-full"
                  checked={checked}
                  inert
                />
                <span
                  className={`min-w-0 flex-1 text-base leading-relaxed break-words ${
                    checked ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {step.text}
                </span>
              </div>
            );
          })}
        </section>
      )}
      <div className="pointer-events-none fixed right-[max(20px,calc((100vw-480px)/2+20px))] bottom-[calc(20px+env(safe-area-inset-bottom))] left-[max(20px,calc((100vw-480px)/2+20px))] z-20 flex items-center justify-between *:pointer-events-auto">
        <Button
          className="disabled:bg-muted disabled:text-muted-foreground min-h-13 rounded-lg px-4.5 shadow-[0_8px_22px_oklch(0_0_0/28%)] disabled:opacity-100"
          variant="outline"
          disabled={completed === 0}
          onClick={onReset}
        >
          {t("reset")}
        </Button>
        <ProgressRing
          completed={completed}
          total={routine.steps.length}
          ariaLabel={`${completed} / ${routine.steps.length} ${t("completed")}`}
        />
      </div>
    </div>
  );
}
