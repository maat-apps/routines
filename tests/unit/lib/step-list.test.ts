import { describe, expect, it } from "vitest";

import {
  appendStep,
  insertStepAfter,
  moveStep,
  previousStepId,
  removeStep,
  stepsForSave,
  updateStepText,
} from "@/lib/step-list";
import type { RoutineStep } from "@/types";

function steps(...texts: string[]): RoutineStep[] {
  return texts.map((text, order) => ({ id: `s${order}`, text, order }));
}

function ids(list: RoutineStep[]): string[] {
  return list.map((step) => step.id);
}

function orders(list: RoutineStep[]): number[] {
  return list.map((step) => step.order);
}

describe("updateStepText", () => {
  it("changes only the matching step's text", () => {
    const result = updateStepText(steps("a", "b"), "s1", "B");

    expect(result.map((step) => step.text)).toEqual(["a", "B"]);
  });
});

describe("appendStep", () => {
  it("adds an empty step at the end with the next order", () => {
    const result = appendStep(steps("a", "b"), "new");

    expect(result.at(-1)).toEqual({ id: "new", text: "", order: 2 });
  });
});

describe("insertStepAfter", () => {
  it("inserts an empty step right after the given one and renumbers", () => {
    const result = insertStepAfter(steps("a", "b", "c"), "s0", "new");

    expect(ids(result)).toEqual(["s0", "new", "s1", "s2"]);
    expect(orders(result)).toEqual([0, 1, 2, 3]);
    expect(result[1].text).toBe("");
  });

  it("inserts at the start when the given step is unknown", () => {
    const result = insertStepAfter(steps("a"), "missing", "new");

    expect(ids(result)).toEqual(["new", "s0"]);
  });
});

describe("removeStep", () => {
  it("removes the step and renumbers the rest", () => {
    const result = removeStep(steps("a", "b", "c"), "s1");

    expect(ids(result)).toEqual(["s0", "s2"]);
    expect(orders(result)).toEqual([0, 1]);
  });
});

describe("previousStepId", () => {
  it("returns the step before the given one", () => {
    expect(previousStepId(steps("a", "b"), "s1")).toBe("s0");
  });

  it("returns null for the first step", () => {
    expect(previousStepId(steps("a", "b"), "s0")).toBeNull();
  });

  it("returns null for an unknown step", () => {
    expect(previousStepId(steps("a"), "missing")).toBeNull();
  });
});

describe("moveStep", () => {
  it("moves a step down to the drop target and renumbers", () => {
    const result = moveStep(steps("a", "b", "c"), "s0", "s2");

    expect(ids(result)).toEqual(["s1", "s2", "s0"]);
    expect(orders(result)).toEqual([0, 1, 2]);
  });

  it("moves a step up to the drop target", () => {
    const result = moveStep(steps("a", "b", "c"), "s2", "s0");

    expect(ids(result)).toEqual(["s2", "s0", "s1"]);
  });

  it("returns the same array when dropped in place", () => {
    const list = steps("a", "b");

    expect(moveStep(list, "s0", "s0")).toBe(list);
  });

  it("returns the same array for an unknown id", () => {
    const list = steps("a", "b");

    expect(moveStep(list, "s0", "missing")).toBe(list);
    expect(moveStep(list, "missing", "s0")).toBe(list);
  });
});

describe("stepsForSave", () => {
  it("drops blank steps, trims text and renumbers", () => {
    const result = stepsForSave(steps(" a ", "   ", "", "b"));

    expect(result).toEqual([
      { id: "s0", text: "a", order: 0 },
      { id: "s3", text: "b", order: 1 },
    ]);
  });
});
