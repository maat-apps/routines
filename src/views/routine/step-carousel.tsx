import { Check } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import { nextOpenIndex } from "@/lib/routine-utils";
import type { RoutineStep } from "@/types";

function scrollToCard(card: HTMLElement | undefined, smooth: boolean) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  card?.scrollIntoView({
    block: "center",
    behavior: smooth && !reduceMotion ? "smooth" : "auto",
  });
}

/**
 * One step per card in a vertically snapping scroller: swipe to browse, tap
 * a card to check it and the next unchecked step slides into the middle.
 * Steps keep their routine order, so earlier ones stay one swipe away.
 */
export function StepCarousel({
  steps,
  checkedStepIds,
  label,
  onToggle,
}: {
  steps: RoutineStep[];
  checkedStepIds: string[];
  label: string;
  onToggle: (stepId: string) => void;
}) {
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const first = steps.findIndex((step) => !checkedStepIds.includes(step.id));
    scrollToCard(cards.current[Math.max(first, 0)] ?? undefined, false);
    // Only the opening position: later moves follow the user's own taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(step: RoutineStep, index: number) {
    const wasChecked = checkedStepIds.includes(step.id);
    onToggle(step.id);
    if (wasChecked) return;
    const next = nextOpenIndex(steps, [...checkedStepIds, step.id], index);
    if (next !== -1) scrollToCard(cards.current[next] ?? undefined, true);
  }

  return (
    <section
      aria-label={label}
      className="-mx-5 flex h-[60dvh] snap-y snap-mandatory flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-[19dvh]"
    >
      {steps.map((step, index) => {
        const checked = checkedStepIds.includes(step.id);
        return (
          <div
            key={step.id}
            ref={(element) => {
              cards.current[index] = element;
            }}
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={() => toggle(step, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle(step, index);
              }
            }}
            className={`border-border active:bg-muted flex h-[22dvh] shrink-0 cursor-pointer snap-center items-center gap-4 rounded-lg border px-5 text-left transition-opacity ${
              checked ? "opacity-50" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input"
              }`}
            >
              {checked && <Check className="size-4" />}
            </span>
            <span
              className={`line-clamp-4 min-w-0 flex-1 text-xl wrap-break-word ${
                checked ? "line-through" : ""
              }`}
            >
              {step.text}
            </span>
          </div>
        );
      })}
    </section>
  );
}
