import { startTransition } from "react";
import { useNavigate, useParams } from "react-router";

import { MissingRoutine } from "@/components/missing-routine";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines, useRoutineState } from "@/hooks/use-store";
import { resetRoutine, toggleStep } from "@/lib/storage";
import { RoutineDetail } from "@/views/routine/routine-detail";

export function RoutineView() {
  const navigate = useNavigate();
  const smartBack = useSmartBack("/");
  const { id: routineId } = useParams();
  const routines = useRoutines();
  const state = useRoutineState();
  const routine = routineId
    ? (routines.find((item) => item.id === routineId) ?? null)
    : null;

  if (!routine) return <MissingRoutine />;
  return (
    <RoutineDetail
      routine={routine}
      progress={state[routine.id]}
      onBack={() => startTransition(smartBack)}
      onEdit={() =>
        startTransition(() =>
          navigate(`/${encodeURIComponent(routine.id)}/edit`),
        )
      }
      onToggle={(_, stepId) => toggleStep(routine.id, stepId)}
      onReset={() => resetRoutine(routine.id)}
    />
  );
}
