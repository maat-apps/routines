import {
  ArrowCounterClockwise,
  Check,
  SkipForward,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { moveToEnd } from "@/lib/routine-utils";
import type { RoutineDeck, RoutineStep } from "@/types";
import { Button } from "@maat-apps/ui/button";

const SWIPE_THRESHOLD_PX = 96;
const FLY_OUT_MS = 180;
// Farther steps stay hidden so the active card is always on screen.
const VISIBLE_UPCOMING = 4;

/** The saved order minus deleted steps, with steps added since at the end. */
function reconcileOrder(saved: string[] | undefined, steps: RoutineStep[]) {
  const known = new Set(steps.map((step) => step.id));
  const kept = (saved ?? []).filter((id) => known.has(id));
  const added = steps.map((step) => step.id).filter((id) => !kept.includes(id));
  return [...kept, ...added];
}

/**
 * Open steps stacked above one active card at the bottom, within thumb
 * reach: swipe it right to check it, left to send it to the end of the
 * list. The next step in line sits right above the active card, dimmed.
 * The order and the undo history live in `deck`, so they outlast the view.
 */
export function StepDeck({
  steps,
  checkedStepIds,
  deck,
  label,
  onToggle,
  onDeckChange,
}: {
  steps: RoutineStep[];
  checkedStepIds: string[];
  deck?: RoutineDeck;
  label: string;
  onToggle: (stepId: string) => void;
  onDeckChange: (deck: RoutineDeck) => void;
}) {
  const { t } = useTranslation();
  const order = reconcileOrder(deck?.order, steps);
  const moves = deck?.moves ?? [];

  function finish(stepId: string) {
    onDeckChange({ order, moves: [...moves, { stepId }] });
    onToggle(stepId);
  }

  function skip(stepId: string) {
    onDeckChange({
      order: moveToEnd(order, stepId),
      moves: [...moves, { stepId, previousOrder: order }],
    });
  }

  function undo() {
    const last = moves.at(-1);
    if (last === undefined) return;
    onDeckChange({
      order: last.previousOrder ?? order,
      moves: moves.slice(0, -1),
    });
    // Toggling an unchecked step would check it, so only undo a live check.
    if (!last.previousOrder && checkedStepIds.includes(last.stepId)) {
      onToggle(last.stepId);
    }
  }

  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const queue = order
    .map((id) => stepsById.get(id))
    .filter(
      (step): step is RoutineStep =>
        step !== undefined && !checkedStepIds.includes(step.id),
    );
  const [active, ...rest] = queue;
  const upcoming = rest.slice(0, VISIBLE_UPCOMING).reverse();

  return (
    <section
      aria-label={label}
      className="flex min-h-[calc(100dvh-6.75rem-116px-env(safe-area-inset-bottom))] flex-col justify-end gap-2"
    >
      {active === undefined ? (
        <p className="text-muted-foreground m-auto text-center text-lg">
          {t("allStepsDone")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {upcoming.map((step) => (
              <li
                key={step.id}
                className="border-border line-clamp-2 rounded-lg border px-5 py-4 text-base wrap-break-word opacity-40"
              >
                {step.text}
              </li>
            ))}
          </ul>
          <SwipeCard
            key={active.id}
            text={active.text}
            onDone={() => finish(active.id)}
            onSkip={() => skip(active.id)}
          />
        </>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {active && t("swipeHint")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={moves.length === 0}
          onClick={undo}
        >
          <ArrowCounterClockwise aria-hidden="true" /> {t("undo")}
        </Button>
      </div>
    </section>
  );
}

function SwipeCard({
  text,
  onDone,
  onSkip,
}: {
  text: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const settled = useRef(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flyOut(direction: 1 | -1) {
    if (settled.current) return;
    settled.current = true;
    setDragging(false);
    setOffset(direction * window.innerWidth);
    timer.current = window.setTimeout(
      direction === 1 ? onDone : onSkip,
      FLY_OUT_MS,
    );
  }

  function release() {
    if (!dragging) return;
    if (Math.abs(offset) >= SWIPE_THRESHOLD_PX) {
      flyOut(offset > 0 ? 1 : -1);
      return;
    }
    setDragging(false);
    setOffset(0);
  }

  const pull = Math.min(Math.abs(offset) / SWIPE_THRESHOLD_PX, 1);

  return (
    <div
      role="group"
      aria-label={text}
      aria-keyshortcuts="ArrowRight ArrowLeft"
      tabIndex={0}
      onPointerDown={(event) => {
        if (settled.current) return;
        startX.current = event.clientX;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragging) setOffset(event.clientX - startX.current);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "Enter") {
          event.preventDefault();
          flyOut(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          flyOut(-1);
        }
      }}
      style={{
        transform: `translateX(${offset}px) rotate(${offset / 20}deg)`,
        transition: dragging ? "none" : `transform ${FLY_OUT_MS}ms ease-out`,
      }}
      className="border-border bg-background relative flex min-h-40 touch-pan-y items-center justify-center rounded-lg border px-14 text-center text-xl wrap-break-word select-none"
    >
      <Check
        aria-hidden="true"
        className="absolute left-5 size-7"
        style={{ opacity: offset > 0 ? pull : 0 }}
      />
      <span className="line-clamp-4 min-w-0">{text}</span>
      <SkipForward
        aria-hidden="true"
        className="absolute right-5 size-7"
        style={{ opacity: offset < 0 ? pull : 0 }}
      />
    </div>
  );
}
