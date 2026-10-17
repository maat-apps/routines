// Canonical types for the app's data shapes. The types themselves are inferred
// from the Valibot schemas in src/lib/schemas.ts (the runtime validators for
// this same data) — re-exported here so the rest of the app can keep importing
// from "@/types" without needing to know that schemas.ts is where they're defined.
export type {
  AppData,
  Routine,
  RoutineDeck,
  RoutineProgress,
  RoutineState,
  RoutineStep,
} from "@/lib/schemas";
