import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DragHandle } from "@/components/drag-handle";
import { RoutineRowContent } from "@/components/routine-row-content";
import type { Routine } from "@/types";

export function SortableRoutineRow({
  routine,
  checkedCount,
  completedLabel,
  unnamedLabel,
  dragLabel,
  onOpen,
}: {
  routine: Routine;
  checkedCount: number;
  completedLabel: string;
  unnamedLabel: string;
  dragLabel: string;
  onOpen: (routineId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: routine.id });

  return (
    <div
      className={`bg-card text-card-foreground has-[[data-main]:active]:bg-muted flex min-h-18 w-full items-center gap-0 rounded-lg py-0 pr-4 pl-2 text-left transition-colors ${
        isDragging ? "relative z-1 shadow-[0_8px_20px_oklch(0_0_0/20%)]" : ""
      }`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <DragHandle
        className="text-muted-foreground flex-none"
        dragLabel={dragLabel}
        attributes={attributes}
        listeners={listeners}
      />
      <button
        data-main="true"
        className="[&>svg]:text-muted-foreground flex min-h-18 min-w-0 flex-1 items-center gap-3.5 rounded-lg border-0 bg-transparent py-3.5 pr-0 pl-2 text-left text-inherit"
        onClick={() => onOpen(routine.id)}
      >
        <RoutineRowContent
          routine={routine}
          checkedCount={checkedCount}
          completedLabel={completedLabel}
          unnamedLabel={unnamedLabel}
        />
      </button>
    </div>
  );
}
