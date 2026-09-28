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
 * Moves `activeId` to `overId`'s position (a drag-and-drop drop). Returns
 * the same array when nothing moves: dropped in place or an unknown id.
 */
export function moveStep(
  steps: RoutineStep[],
  activeId: string,
  overId: string,
): RoutineStep[] {
  const from = steps.findIndex((step) => step.id === activeId);
  const to = steps.findIndex((step) => step.id === overId);
  if (from === -1 || to === -1 || from === to) return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return renumber(next);
}

/** What gets saved: blank steps dropped, text trimmed, order renumbered. */
export function stepsForSave(steps: RoutineStep[]): RoutineStep[] {
  return renumber(
    steps
      .filter((step) => step.text.trim().length > 0)
      .map((step) => ({ ...step, text: step.text.trim() })),
  );
}
