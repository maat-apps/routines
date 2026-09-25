import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { type ChangeEvent, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RoutineStep } from "@/types";

const editStepButtonClass = "size-10.5 flex-none [&>svg]:size-5";

export function SortableStepRow({
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
