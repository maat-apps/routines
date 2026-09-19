import { describe, expect, it } from "vitest";

import { ALL_DAYS, parseRoutines, parseState } from "@/lib/schemas";

describe("parseRoutines", () => {
  it("returns an empty array for non-array input", () => {
    expect(parseRoutines(null)).toEqual([]);
    expect(parseRoutines("not an array")).toEqual([]);
    expect(parseRoutines({})).toEqual([]);
  });

  it("returns an empty array for an empty array", () => {
    expect(parseRoutines([])).toEqual([]);
  });

  it("passes through a valid routine with valid steps unchanged", () => {
    const routine = {
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [1, 3, 5],
      steps: [{ id: "s1", text: "Drink water", order: 0 }],
    };
    expect(parseRoutines([routine])).toEqual([routine]);
  });

  it("drops a routine missing a required field", () => {
    const routines = [
      { name: "No id", order: 0, steps: [] },
      { id: "r2", order: 0, steps: [] },
      { id: "r3", name: "No order", steps: [] },
    ];
    expect(parseRoutines(routines)).toEqual([]);
  });

  it("drops one bad step without dropping the routine or its other steps", () => {
    const routine = {
      id: "r1",
      name: "Morning",
      order: 0,
      steps: [
        { id: "s1", text: "Drink water", order: 0 },
        { id: "s2", order: 1 },
        { id: "s3", text: "Stretch", order: 2 },
      ],
    };
    expect(parseRoutines([routine])).toEqual([
      {
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays: ALL_DAYS,
        steps: [
          { id: "s1", text: "Drink water", order: 0 },
          { id: "s3", text: "Stretch", order: 2 },
        ],
      },
    ]);
  });

  it("treats a non-array steps field as no steps, not a crash", () => {
    const routine = { id: "r1", name: "Morning", order: 0, steps: "oops" };
    expect(parseRoutines([routine])).toEqual([
      { id: "r1", name: "Morning", order: 0, activeDays: ALL_DAYS, steps: [] },
    ]);
  });

  it("ignores unknown fields on a routine", () => {
    const routine = {
      id: "r1",
      name: "Morning",
      order: 0,
      steps: [],
      extra: "field",
    };
    expect(parseRoutines([routine])).toEqual([
      { id: "r1", name: "Morning", order: 0, activeDays: ALL_DAYS, steps: [] },
    ]);
  });

  it("defaults activeDays to every day when the field is missing (old data)", () => {
    const routine = { id: "r1", name: "Morning", order: 0, steps: [] };
    expect(parseRoutines([routine])).toEqual([
      { ...routine, activeDays: ALL_DAYS },
    ]);
  });

  it("falls back to every day for a malformed activeDays value", () => {
    const cases = ["not an array", [1, "tuesday", 3], [1, 9], [1, -1], [1.5]];
    for (const activeDays of cases) {
      const routine = {
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays,
        steps: [],
      };
      expect(parseRoutines([routine])).toEqual([
        {
          id: "r1",
          name: "Morning",
          order: 0,
          activeDays: ALL_DAYS,
          steps: [],
        },
      ]);
    }
  });

  it("keeps a valid, non-default activeDays value as-is, including empty", () => {
    const routine = {
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [] as number[],
      steps: [],
    };
    expect(parseRoutines([routine])).toEqual([routine]);
  });
});

describe("parseState", () => {
  it("returns an empty object for non-record input", () => {
    expect(parseState(null)).toEqual({});
    expect(parseState([1, 2, 3])).toEqual({});
    expect(parseState("nope")).toEqual({});
  });

  it("passes through a valid state map", () => {
    const state = {
      r1: { checkedStepIds: ["s1"], lastResetDate: "2026-09-17" },
    };
    expect(parseState(state)).toEqual(state);
  });

  it("drops one malformed entry without wiping the others", () => {
    const state = {
      r1: { checkedStepIds: ["s1"], lastResetDate: "2026-09-17" },
      r2: { checkedStepIds: "not an array", lastResetDate: "2026-09-17" },
    };
    expect(parseState(state)).toEqual({
      r1: { checkedStepIds: ["s1"], lastResetDate: "2026-09-17" },
    });
  });

  it("drops an entry with wrong-typed checkedStepIds instead of coercing it", () => {
    const state = {
      r1: { checkedStepIds: "s1", lastResetDate: "2026-09-17" },
    };
    expect(parseState(state)).toEqual({});
  });
});
