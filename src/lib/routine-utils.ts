import type { Routine, RoutineStep } from "@/types";

export function createId(): string {
  return crypto.randomUUID();
}

export function sortSteps(steps: RoutineStep[]): RoutineStep[] {
  return [...steps].sort((left, right) => left.order - right.order);
}

/** `YYYY-MM-DD`, zero-padded, in the local timezone. */
export function formatDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  style: "short" | "narrow" | "long" = "short",
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

// Intl.Locale.prototype.getWeekInfo() reports a locale's actual first day of
// week (1=Monday..7=Sunday, per the spec) without hand-maintaining a locale
// table — not yet supported by every engine (older WebKit), so this falls
// back to a fixed value for this app's only two supported locales: "en"
// defaults to Sunday-first (CLDR root default, matching what getWeekInfo()
// itself reports where it's available), "pl" to Monday-first (ISO 8601).
function firstDayOfWeek(locale: string): number {
  try {
    const info = (
      new Intl.Locale(locale) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
      }
    ).getWeekInfo?.();
    if (info) return info.firstDay;
  } catch {
    // Fall through to the fixed default below.
  }
  return locale === "pl" ? 1 : 7;
}

// Day indices (0=Sunday..6=Saturday, matching weekdayLabels/DaySchema) in
// the order a locale actually renders its calendar week — e.g. Monday-first
// for "pl" instead of always starting from Sunday.
export function weekOrder(locale: string): number[] {
  const first = firstDayOfWeek(locale) % 7; // spec's 7 (Sunday) -> day index 0
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}
