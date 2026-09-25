import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { ProgressRing } from "@/components/progress-ring";
import type { Routine } from "@/types";

/**
 * The ring + name + chevron every routine row (the plain list in
 * all-routines-view.tsx, the draggable one in sortable-routine-row.tsx)
 * shows — the caller owns the outer clickable/draggable wrapper.
 */
export function RoutineRowContent({
  routine,
  checkedCount,
  completedLabel,
  unnamedLabel,
  subtitle,
}: {
  routine: Routine;
  checkedCount: number;
  completedLabel: string;
  unnamedLabel: string;
  subtitle?: ReactNode;
}) {
  return (
    <>
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
        {subtitle}
      </span>
      <ChevronRight aria-hidden="true" />
    </>
  );
}
