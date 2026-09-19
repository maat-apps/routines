import { describe, expect, it } from "vitest";

import {
  createId,
  isRoutineActiveToday,
  sortSteps,
  weekdayLabels,
} from "@/lib/routine-utils";
import type { Routine } from "@/types";

function routine(activeDays: number[]): Routine {
  return { id: "r1", name: "Morning", order: 0, activeDays, steps: [] };
}

describe("createId", () => {
  it("returns a UUID-shaped string", () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns a different id on each call", () => {
    expect(createId()).not.toBe(createId());
  });
});

describe("sortSteps", () => {
  it("sorts steps by order", () => {
    const steps = [
      { id: "s3", text: "C", order: 2 },
      { id: "s1", text: "A", order: 0 },
      { id: "s2", text: "B", order: 1 },
    ];
    expect(sortSteps(steps).map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("does not mutate the input array", () => {
    const steps = [
      { id: "s2", text: "B", order: 1 },
      { id: "s1", text: "A", order: 0 },
    ];
    const original = [...steps];
    sortSteps(steps);
    expect(steps).toEqual(original);
  });
});

describe("isRoutineActiveToday", () => {
  // 2026-09-13 is a Sunday (getDay() === 0); 2026-09-16 is a Wednesday (3).
  const sunday = new Date(2026, 8, 13);
  const wednesday = new Date(2026, 8, 16);

  it("is true when the date's weekday is in activeDays", () => {
    expect(isRoutineActiveToday(routine([0, 3, 6]), sunday)).toBe(true);
    expect(isRoutineActiveToday(routine([0, 3, 6]), wednesday)).toBe(true);
  });

  it("is false when the date's weekday is not in activeDays", () => {
    expect(isRoutineActiveToday(routine([1, 2, 4, 5]), sunday)).toBe(false);
  });

  it("is false for an empty activeDays (every day turned off)", () => {
    expect(isRoutineActiveToday(routine([]), sunday)).toBe(false);
  });

  it("defaults to the current date when none is given", () => {
    expect(isRoutineActiveToday(routine([0, 1, 2, 3, 4, 5, 6]))).toBe(true);
  });
});

describe("weekdayLabels", () => {
  it("returns 7 labels, Sunday first, matching Date#getDay() order", () => {
    const labels = weekdayLabels("en-US", "short");
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe("Sun");
    expect(labels[3]).toBe("Wed");
    expect(labels[6]).toBe("Sat");
  });

  it("localizes via the given locale", () => {
    const labels = weekdayLabels("pl-PL", "short");
    expect(labels).toHaveLength(7);
    // Polish short weekday labels don't collide with the English ones.
    expect(labels).not.toEqual(weekdayLabels("en-US", "short"));
  });

  it("narrow style gives single-letter labels with no trailing punctuation", () => {
    // The day picker's actual production style — "short" appends a dot in
    // Polish ("pon.", "wt.", ...), which narrow avoids entirely.
    for (const locale of ["en-US", "pl-PL"]) {
      const labels = weekdayLabels(locale, "narrow");
      expect(labels).toHaveLength(7);
      for (const label of labels) {
        expect(label).toMatch(/^\p{L}$/u);
      }
    }
  });
});
