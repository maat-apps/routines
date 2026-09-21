import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Plus, Trash2 } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { AppBar } from "@/components/app-bar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/use-translation";
import {
  createId,
  sortSteps,
  weekdayLabels,
  weekOrder,
} from "@/lib/routine-utils";
import type { Routine, RoutineStep } from "@/types";

const editStepButtonClass = "size-10.5 flex-none [&>svg]:size-5";

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
  // Visible chips use "narrow" (a single letter, e.g. "m"/"t"); the full
  // name goes on each button's aria-label instead — narrow labels repeat
  // (English "T" is both Tuesday and Thursday), fine for sighted users who
  // also see the chips in a fixed order (locale-dependent, but stable), but
  // a genuinely ambiguous accessible name for screen readers otherwise.
  const weekdayNames = weekdayLabels(locale, "long");
  const narrowWeekdayLabels = weekdayLabels(locale, "narrow");
  const orderedDays = weekOrder(locale);

  function toggleDay(day: number) {
    setActiveDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function updateStep(stepId: string, text: string) {
    setSteps((current) =>
      current.map((step) => (step.id === stepId ? { ...step, text } : step)),
    );
  }

  function addStep() {
    const id = createId();
    setSteps((current) => [
      ...current,
      { id, text: "", order: current.length },
    ]);
    setFocusStepId(id);
  }

  function addStepAfter(stepId: string) {
    const id = createId();
    setSteps((current) => {
      const index = current.findIndex((step) => step.id === stepId);
      const next = [...current];
      next.splice(index + 1, 0, { id, text: "", order: 0 });
      return next.map((step, position) => ({ ...step, order: position }));
    });
    setFocusStepId(id);
  }

  function removeStep(stepId: string) {
    setSteps((current) =>
      current
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index })),
    );
  }

  function mergeStepUp(stepId: string) {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index <= 0) return;
    const previousId = steps[index - 1].id;
    setSteps((current) =>
      current
        .filter((step) => step.id !== stepId)
        .map((step, position) => ({ ...step, order: position })),
    );
    setFocusStepId(previousId);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((step) => step.id === active.id);
    const newIndex = steps.findIndex((step) => step.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setSteps(
      arrayMove(steps, oldIndex, newIndex).map((step, index) => ({
        ...step,
        order: index,
      })),
    );
  }

  function save() {
    onSave({
      ...routine,
      name: name.trim(),
      activeDays,
      steps: steps
        .filter((step) => step.text.trim().length > 0)
        .map((step, index) => ({
          ...step,
          text: step.text.trim(),
          order: index,
        })),
    });
    (onComplete ?? onBack)();
  }

  return (
    <div className="mx-auto min-h-dvh w-[min(100%,480px)] px-5 pt-27 pb-[calc(132px+env(safe-area-inset-bottom))]">
      <AppBar title={title} onBack={onBack} />
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
      <section className="mb-7.5 grid gap-2.25">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-sm font-semibold">{t("activeDaysTitle")}</h2>
          <CalendarDays
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
        </div>
        <div
          className="mx-auto grid grid-cols-7 gap-3"
          role="group"
          aria-label={t("activeDaysTitle")}
        >
          {orderedDays.map((day) => (
            <Button
              key={day}
              type="button"
              variant={activeDays.includes(day) ? "default" : "outline"}
              className="flex h-10 min-w-10 items-center justify-center rounded-full px-0 pb-0.5 text-sm"
              aria-pressed={activeDays.includes(day)}
              aria-label={weekdayNames[day]}
              onClick={() => toggleDay(day)}
            >
              {narrowWeekdayLabels[day].toLowerCase()}
            </Button>
          ))}
        </div>
      </section>
      <section className="grid gap-2.25">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-sm font-semibold">{t("stepsTitle")}</h2>
          <span className="text-muted-foreground text-sm">{steps.length}</span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((step) => step.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-[minmax(0,1fr)]">
              {steps.map((step, index) => (
                <SortableStepRow
                  key={step.id}
                  step={step}
                  placeholder={t("addStepPlaceholder")}
                  stepLabel={t("stepNumber", { number: index + 1 })}
                  dragLabel={t("dragStep")}
                  deleteLabel={t("deleteStep")}
                  autoFocus={step.id === focusStepId}
                  onChange={updateStep}
                  onDelete={removeStep}
                  onEnter={addStepAfter}
                  onMergeUp={mergeStepUp}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
          <Trash2 /> {t("deleteRoutine")}
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
      <Drawer showSwipeHandle open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DrawerContent>
          <DrawerHeader className="group-data-[swipe-axis=y]/drawer-popup:text-left">
            <DrawerTitle>{t("deleteRoutineTitle")}</DrawerTitle>
            <DrawerDescription>
              {t("deleteRoutineDescription")}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[calc(16px+env(safe-area-inset-bottom))]">
            <Button
              className="min-h-12.5 text-base"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className="min-h-12.5 text-base"
              variant="destructive"
              onClick={onDelete}
            >
              {t("deleteRoutine")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SortableStepRow({
  step,
  placeholder,
  stepLabel,
  dragLabel,
  deleteLabel,
  autoFocus = false,
  onChange,
  onDelete,
  onEnter,
  onMergeUp,
}: {
  step: RoutineStep;
  placeholder: string;
  stepLabel: string;
  dragLabel: string;
  deleteLabel: string;
  autoFocus?: boolean;
  onChange: (stepId: string, text: string) => void;
  onDelete: (stepId: string) => void;
  onEnter: (stepId: string) => void;
  onMergeUp: (stepId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }, [autoFocus]);

  // Textareas don't grow to fit their content on their own — resize on every
  // value change (typing, backspace, a paste) so a multi-line step never
  // shows a scrollbar instead of just growing the row.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [step.text]);

  return (
    <div
      className={`border-border flex items-center gap-2 border-b py-2.5 last:border-b-0 ${
        isDragging
          ? "bg-card relative z-1 shadow-[0_8px_20px_oklch(0_0_0/20%)]"
          : ""
      }`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        className={`${editStepButtonClass} cursor-grab touch-none active:cursor-grabbing`}
        variant="ghost"
        size="icon-sm"
        aria-label={dragLabel}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <Textarea
        ref={inputRef}
        rows={1}
        className="h-11.5 min-w-0 flex-1 resize-none overflow-hidden border-0 text-base shadow-none focus-visible:border-0 focus-visible:ring-0"
        value={step.text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(step.id, event.target.value)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onEnter(step.id);
          } else if (
            (event.key === "Backspace" || event.key === "Delete") &&
            step.text === ""
          ) {
            onMergeUp(step.id);
          }
        }}
        placeholder={placeholder}
        aria-label={stepLabel}
      />
      <Button
        className={editStepButtonClass}
        variant="ghost"
        size="icon-sm"
        aria-label={deleteLabel}
        onClick={() => onDelete(step.id)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
