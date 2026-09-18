import type { Routine, RoutineStep } from "@/types";

export function createId(): string {
  return crypto.randomUUID();
}

export function sortSteps(steps: RoutineStep[]): RoutineStep[] {
  return [...steps].sort((left, right) => left.order - right.order);
}

// date's Date#getDay() (0 = Sunday .. 6 = Saturday) matches schemas.ts's
// DaySchema numbering directly — no weekday-convention conversion needed.
export function isRoutineActiveToday(
  routine: Routine,
  date = new Date(),
): boolean {
  return routine.activeDays.includes(date.getDay());
}

// Localized weekday labels, index 0 (Sunday) .. 6 (Saturday) to line up with
// DaySchema/isRoutineActiveToday's own numbering — for the day-of-week
// picker in routine-edit-form.tsx. Native Intl instead of hand-translated
// i18n keys, the same way dates are formatted elsewhere in the app.
export function weekdayLabels(
  locale: string,
  style: "short" | "narrow" = "short",
): string[] {
  // 1970-01-04 was a Sunday — an arbitrary anchor date whose getDay()
  // sequence for the following 6 days is exactly 0..6.
  const sunday = new Date(1970, 0, 4);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, day) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + day);
    return formatter.format(date);
  });
}
