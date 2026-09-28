import type { RoutineStep } from "@/types";

// The routine edit form's step-list operations, kept pure (ids are passed
// in, never generated here) so they're unit-testable. Every operation that
// adds, removes or moves a step renumbers `order` to match array position.

function renumber(steps: RoutineStep[]): RoutineStep[] {
  return steps.map((step, index) => ({ ...step, order: index }));
}

export function updateStepText(
  steps: RoutineStep[],
  stepId: string,
  text: string,
): RoutineStep[] {
  return steps.map((step) => (step.id === stepId ? { ...step, text } : step));
}

export function appendStep(steps: RoutineStep[], id: string): RoutineStep[] {
  return [...steps, { id, text: "", order: steps.length }];
}

/** Inserts an empty step right after `afterId` (at the start if not found). */
export function insertStepAfter(
  steps: RoutineStep[],
  afterId: string,
  id: string,
): RoutineStep[] {
  const index = steps.findIndex((step) => step.id === afterId);
  const next = [...steps];
  next.splice(index + 1, 0, { id, text: "", order: 0 });
  return renumber(next);
}

export function removeStep(
  steps: RoutineStep[],
  stepId: string,
): RoutineStep[] {
  return renumber(steps.filter((step) => step.id !== stepId));
}

/** The step before `stepId`, or null for the first (or an unknown) step. */
export function previousStepId(
  steps: RoutineStep[],
  stepId: string,
): string | null {
  const index = steps.findIndex((step) => step.id === stepId);
  return index > 0 ? steps[index - 1].id : null;
}

/**
 * Puts the steps in `orderedIds`' order (a drag-and-drop drop, as reported by
 * SortableList) and renumbers. Steps missing from `orderedIds` keep their
 * relative order after the listed ones; unknown ids are ignored.
 */
export function reorderSteps(
  steps: RoutineStep[],
  orderedIds: string[],
): RoutineStep[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  const rank = (step: RoutineStep) =>
    position.get(step.id) ?? orderedIds.length;
  return renumber([...steps].sort((a, b) => rank(a) - rank(b)));
}

/** What gets saved: blank steps dropped, text trimmed, order renumbered. */
export function stepsForSave(steps: RoutineStep[]): RoutineStep[] {
  return renumber(
    steps
      .filter((step) => step.text.trim().length > 0)
      .map((step) => ({ ...step, text: step.text.trim() })),
  );
}
