import type { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The grab handle every drag-to-reorder row (routines, routine steps) uses. */
export function DragHandle({
  dragLabel,
  className,
  attributes,
  listeners,
}: {
  dragLabel: string;
  className?: string;
} & Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) {
  return (
    <Button
      className={cn("cursor-grab touch-none active:cursor-grabbing", className)}
      variant="ghost"
      size="icon-sm"
      aria-label={dragLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden="true" />
    </Button>
  );
}
