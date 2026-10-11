import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { SortableStepRow } from "@/components/sortable-step-row";
import { WeekdayPicker } from "@/components/weekday-picker";
import { useTranslation } from "@/i18n/use-translation";
import { createId, sortSteps } from "@/lib/routine-utils";
import {
  appendStep,
  insertStepAfter,
  previousStepId,
  removeStep,
  reorderSteps,
  stepsForSave,
  updateStepText,
} from "@/lib/step-list";
import type { Routine } from "@/types";
import { AppBar } from "@maat-apps/ui/app-bar";
import { Button } from "@maat-apps/ui/button";
import { ConfirmDrawer } from "@maat-apps/ui/confirm-drawer";
import { Input } from "@maat-apps/ui/input";
import { SortableList } from "@maat-apps/ui/sortable-list";
import { SectionTitle } from "@maat-apps/ui/page-header";

// Shared by the "/new" and "/:id/edit" views — the only difference between
// creating and editing a routine is what happens on save/back/delete.
export function RoutineEditForm({
  routine,
  title,
  onBack,
  onSave,
  onDelete,
  onComplete,
  showDelete = true,
}: {
  routine: Routine;
  title: string;
  onBack: () => void;
  onSave: (routine: Routine) => void;
  onDelete: () => void;
  onComplete?: () => void;
  showDelete?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [name, setName] = useState(routine.name);
  const [steps, setSteps] = useState(sortSteps(routine.steps));
  const [activeDays, setActiveDays] = useState(routine.activeDays);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const canSave =
    name.trim().length > 0 && steps.some((step) => step.text.trim().length > 0);

  function toggleDay(day: number) {
    setActiveDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  function updateStep(stepId: string, text: string) {
    setSteps((current) => updateStepText(current, stepId, text));
  }

  function addStep() {
    const id = createId();
    setSteps((current) => appendStep(current, id));
    setFocusStepId(id);
  }

  function addStepAfter(stepId: string) {
    const id = createId();
    setSteps((current) => insertStepAfter(current, stepId, id));
    setFocusStepId(id);
  }

  function deleteStep(stepId: string) {
    setSteps((current) => removeStep(current, stepId));
  }

  function mergeStepUp(stepId: string) {
    const previousId = previousStepId(steps, stepId);
    if (previousId === null) return;
    deleteStep(stepId);
    setFocusStepId(previousId);
  }

  function reorder(orderedIds: string[]) {
    setSteps((current) => reorderSteps(current, orderedIds));
  }

  function save() {
    onSave({
      ...routine,
      name: name.trim(),
      activeDays,
      steps: stepsForSave(steps),
    });
    (onComplete ?? onBack)();
  }

  return (
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-27 pb-[calc(132px+env(safe-area-inset-bottom))]">
      <AppBar title={title} backLabel={t("back")} onBack={onBack} />
      <section className="mb-7.5 grid gap-2.25">
        <label htmlFor="routine-name" className="text-sm font-semibold">
          {t("routineName")}
        </label>
        <Input
          id="routine-name"
          className="h-13 text-lg"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("routineNamePlaceholder")}
          autoFocus
        />
      </section>
      <WeekdayPicker
        locale={locale}
        title={t("activeDaysTitle")}
        activeDays={activeDays}
        onToggle={toggleDay}
      />
      <section className="grid gap-2.25">
        <div className="flex items-center justify-between">
          <SectionTitle>{t("stepsTitle")}</SectionTitle>
          <span className="text-muted-foreground text-sm">{steps.length}</span>
        </div>
        <SortableList
          items={steps}
          onReorder={reorder}
          renderItem={(step, index) => (
            <SortableStepRow
              key={step.id}
              step={step}
              placeholder={t("addStepPlaceholder")}
              stepLabel={t("stepNumber", { number: index + 1 })}
              dragLabel={t("dragStep")}
              deleteLabel={t("deleteStep")}
              autoFocus={step.id === focusStepId}
              onChange={updateStep}
              onDelete={deleteStep}
              onEnter={addStepAfter}
              onMergeUp={mergeStepUp}
            />
          )}
        />
        <Button
          variant="outline"
          className="mt-2 min-h-12.5 w-full text-base"
          onClick={addStep}
        >
          <Plus /> {t("addStep")}
        </Button>
      </section>
      {showDelete && (
        <Button
          variant="destructive"
          className="mt-12 min-h-12.5 w-full text-base"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash /> {t("deleteRoutine")}
        </Button>
      )}
      <div className="border-border bg-background fixed right-0 bottom-0 left-0 z-20 border-t px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <Button
          className="mx-auto flex min-h-14 w-[min(100%,440px)] rounded-lg text-base shadow-[0_8px_22px_oklch(0_0_0/28%)]"
          disabled={!canSave}
          onClick={save}
        >
          {t("done")}
        </Button>
      </div>
      <ConfirmDrawer
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteRoutineTitle")}
        description={t("deleteRoutineDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("deleteRoutine")}
        onConfirm={onDelete}
      />
    </div>
  );
}
