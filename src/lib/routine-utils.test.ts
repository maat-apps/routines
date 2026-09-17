import { describe, expect, it } from "vitest";

import { createId, sortSteps } from "@/lib/routine-utils";

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
