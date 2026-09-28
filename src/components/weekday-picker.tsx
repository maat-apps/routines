import { CalendarDots } from "@phosphor-icons/react";

import { weekdayLabels, weekOrder } from "@/lib/routine-utils";
import { Button } from "@maat-apps/ui/button";

/** The seven day chips of the routine edit form, in the locale's week order. */
export function WeekdayPicker({
  locale,
  title,
  activeDays,
  onToggle,
}: {
  locale: string;
  title: string;
  activeDays: number[];
  onToggle: (day: number) => void;
}) {
  // Visible chips use "narrow" (a single letter, e.g. "m"/"t"); the full
  // name goes on each button's aria-label instead — narrow labels repeat
  // (English "T" is both Tuesday and Thursday), fine for sighted users who
  // also see the chips in a fixed order (locale-dependent, but stable), but
  // a genuinely ambiguous accessible name for screen readers otherwise.
  const weekdayNames = weekdayLabels(locale, "long");
  const narrowWeekdayLabels = weekdayLabels(locale, "narrow");

  return (
    <section className="mb-7.5 grid gap-2.25">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        <CalendarDots
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
      </div>
      <div
        className="mx-auto grid grid-cols-7 gap-3"
        role="group"
        aria-label={title}
      >
        {weekOrder(locale).map((day) => (
          <Button
            key={day}
            type="button"
            variant={activeDays.includes(day) ? "default" : "outline"}
            className="flex h-10 min-w-10 items-center justify-center rounded-full px-0 pb-0.5 text-sm"
            aria-pressed={activeDays.includes(day)}
            aria-label={weekdayNames[day]}
            onClick={() => onToggle(day)}
          >
            {narrowWeekdayLabels[day].toLowerCase()}
          </Button>
        ))}
      </div>
    </section>
  );
}
