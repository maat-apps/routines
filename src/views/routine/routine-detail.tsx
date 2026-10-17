import { Check, PencilSimple, Plus } from "@phosphor-icons/react";

import { useAppSettings } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { sortSteps } from "@/lib/routine-utils";
import type {
  Routine,
  RoutineDeck,
  RoutineProgress,
  RoutineStep,
} from "@/types";
import { StepDeck } from "@/views/routine/step-deck";
import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { EmptyState } from "@maat-apps/ui/empty-state";
import { ProgressRing } from "@maat-apps/ui/progress-ring";
import { ResetButton } from "@maat-apps/ui/reset-button";

export function RoutineDetail({
  routine,
  progress,
  onBack,
  onEdit,
  onToggle,
  onDeckChange,
  onReset,
}: {
  routine: Routine;
  progress?: RoutineProgress;
  onBack: () => void;
  onEdit: () => void;
  onToggle: (routineId: string, stepId: string) => void;
  onDeckChange: (routineId: string, deck: RoutineDeck) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { thumbLayout } = useAppSettings();
  const checkedStepIds = progress?.checkedStepIds ?? [];
  const completed = checkedStepIds.filter((id) =>
    routine.steps.some((step) => step.id === id),
  ).length;

  const steps = sortSteps(routine.steps);

  function renderStep(step: RoutineStep) {
    return (
      <StepRow
        key={step.id}
        step={step}
        checked={checkedStepIds.includes(step.id)}
        onToggle={() => onToggle(routine.id, step.id)}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-27 pb-[calc(116px+env(safe-area-inset-bottom))]">
      <AppBar
        title={routine.name || t("unnamed")}
        backLabel={t("back")}
        onBack={onBack}
        action={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("editRoutine")}
            onClick={onEdit}
          >
            <PencilSimple className="size-6" />
          </Button>
        }
      />
      {routine.steps.length === 0 ? (
        <EmptyState
          description={t("noSteps")}
          action={{
            label: (
              <>
                <Plus /> {t("addFirstStep")}
              </>
            ),
            onClick: onEdit,
            variant: "outline",
          }}
          className="pt-10"
        />
      ) : thumbLayout ? (
        <StepDeck
          steps={steps}
          checkedStepIds={checkedStepIds}
          deck={progress?.deck}
          label={t("routineSteps")}
          onToggle={(stepId) => onToggle(routine.id, stepId)}
          onDeckChange={(deck) => onDeckChange(routine.id, deck)}
        />
      ) : (
        <section
          className="grid grid-cols-[minmax(0,1fr)]"
          aria-label={t("routineSteps")}
        >
          {steps.map(renderStep)}
        </section>
      )}
      <div className="pointer-events-none fixed right-[max(20px,calc((100vw-480px)/2+20px))] bottom-[calc(20px+env(safe-area-inset-bottom))] left-[max(20px,calc((100vw-480px)/2+20px))] z-20 flex items-center justify-between *:pointer-events-auto">
        <ResetButton disabled={completed === 0} onClick={onReset}>
          {t("reset")}
        </ResetButton>
        <ProgressRing
          completed={completed}
          total={routine.steps.length}
          ariaLabel={`${completed} / ${routine.steps.length} ${t("completed")}`}
        />
      </div>
    </div>
  );
}

function StepRow({
  step,
  checked,
  onToggle,
}: {
  step: RoutineStep;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="border-border text-card-foreground active:bg-muted flex cursor-pointer items-start gap-4 border-b px-4 py-4 text-left transition-colors"
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Plain presentation, not Base UI's <Checkbox> — that
          renders its own interactive role="checkbox" plus a
          hidden-but-focusable native <input>, both genuinely
          nested inside this row's own role="checkbox" regardless
          of `inert` (which lands on Base UI's visual span, not
          the native input, a sibling of it). This row is already
          a complete, valid custom checkbox on its own — this
          span is purely decorative. */}
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input"
        }`}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span
        className={`min-w-0 flex-1 text-base wrap-break-word ${
          checked ? "text-muted-foreground line-through" : ""
        }`}
      >
        {step.text}
      </span>
    </div>
  );
}
