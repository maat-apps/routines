import { startTransition } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { MissingRoutine } from "@/components/missing-routine";
import { RoutineEditForm } from "@/components/routine-edit-form";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { deleteRoutine, saveRoutine } from "@/lib/storage";

export function RoutineEditView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const routineId = searchParams.get("id");
  const routines = useRoutines();
  const routine = routineId
    ? (routines.find((item) => item.id === routineId) ?? null)
    : null;
  const smartBack = useSmartBack(
    `/routine?id=${encodeURIComponent(routineId ?? "")}`,
  );

  if (!routine) return <MissingRoutine />;
  return (
    <RoutineEditForm
      routine={routine}
      title={t("editTitle")}
      onBack={() => startTransition(smartBack)}
      onSave={saveRoutine}
      onDelete={() => {
        // Not wrapped in startTransition like the other navigate() calls here:
        // deleteRoutine's store update forces a synchronous re-render (see
        // storage.ts's useSyncExternalStore-backed store), which would win the
        // race against a transition-deferred navigate and briefly render this
        // view with its now-deleted routine — showing MissingRoutine instead
        // of leaving for "/". Keeping this navigate synchronous batches it
        // together with that update instead.
        deleteRoutine(routine.id);
        // Doesn't collapse an earlier "routine" entry that may still sit
        // behind this one (see features/verify-back-button-behavior.md).
        navigate("/", { replace: true });
      }}
    />
  );
}
