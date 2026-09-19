import * as v from "valibot";

// --- Schemas -------------------------------------------------------------------
// The single source of truth for both runtime validation and the TS types below
// (via v.InferOutput) — a field added or renamed here is enforced everywhere at
// once, so the type and the validator can never silently drift out of sync the
// way two hand-written parallel definitions could.

export const StepSchema = v.object({
  id: v.string(),
  text: v.string(),
  order: v.number(),
});

// Day-of-week index matching Date#getDay() (0 = Sunday .. 6 = Saturday), not
// an ISO weekday — routine-utils.ts's isRoutineActiveToday reads straight off
// Date#getDay(), so the schema and that lookup have to agree on the same
// numbering rather than converting between two conventions.
const DaySchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6));
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// A routine's own fields, kept separate from its `steps` array so one malformed
// step doesn't take the rest of an otherwise-valid routine down with it — see
// parseRoutines below, which validates steps independently of these.
const RoutineFieldsSchema = v.object({
  id: v.string(),
  name: v.string(),
  order: v.number(),
  // v.fallback (not v.optional) so a routine stored/backed-up before this
  // field existed still parses as "every day" instead of failing or ending
  // up with an empty, always-hidden schedule.
  activeDays: v.fallback(v.array(DaySchema), ALL_DAYS),
});

export const RoutineSchema = v.object({
  ...RoutineFieldsSchema.entries,
  steps: v.array(StepSchema),
});

export const ProgressSchema = v.object({
  checkedStepIds: v.array(v.string()),
  lastResetDate: v.string(),
});

export const StateSchema = v.record(v.string(), ProgressSchema);

export const AppDataSchema = v.object({
  routines: v.array(RoutineSchema),
  state: StateSchema,
});

export type RoutineStep = v.InferOutput<typeof StepSchema>;
export type Routine = v.InferOutput<typeof RoutineSchema>;
export type RoutineProgress = v.InferOutput<typeof ProgressSchema>;
export type RoutineState = v.InferOutput<typeof StateSchema>;
export type AppData = v.InferOutput<typeof AppDataSchema>;

// --- Lenient parsing -------------------------------------------------------------
// Applied to both a user-supplied backup import and whatever's actually in
// localStorage: anything unrecognised is dropped rather than trusted, since a
// malformed entry (a future write bug, external tampering via devtools, or a
// hand-edited backup file) shouldn't crash a screen that assumes well-shaped
// data. Each array/record entry — routine, step, and progress entry alike — is
// validated on its own, so one bad one doesn't take the rest of an otherwise-
// valid import or stored blob down with it: v.array/v.record fail the whole
// container on a single bad element, which is more than this posture wants.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEach<T>(
  schema: v.GenericSchema<unknown, T>,
  items: unknown[],
): T[] {
  return items
    .map((item) => v.safeParse(schema, item))
    .filter((result) => result.success)
    .map((result) => result.output);
}

export function parseRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const fields = v.safeParse(RoutineFieldsSchema, item);
    if (!fields.success) return [];
    const rawSteps =
      isRecord(item) && Array.isArray(item.steps) ? item.steps : [];
    return [{ ...fields.output, steps: parseEach(StepSchema, rawSteps) }];
  });
}

export function parseState(value: unknown): RoutineState {
  if (!isRecord(value)) return {};
  const state: RoutineState = {};
  for (const [routineId, progress] of Object.entries(value)) {
    const result = v.safeParse(ProgressSchema, progress);
    if (result.success) state[routineId] = result.output;
  }
  return state;
}
