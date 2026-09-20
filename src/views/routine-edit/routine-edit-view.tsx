import { startTransition } from "react";
import { useNavigate, useParams } from "react-router";

import { MissingRoutine } from "@/components/missing-routine";
import { RoutineEditForm } from "@/components/routine-edit-form";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { deleteRoutine, saveRoutine } from "@/lib/storage";

export function RoutineEditView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: routineId } = useParams();
  const routines = useRoutines();
  const routine = routineId
    ? (routines.find((item) => item.id === routineId) ?? null)
    : null;
  const smartBack = useSmartBack(
    `/routine/${encodeURIComponent(routineId ?? "")}`,
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
        // behind this one — a second back tap can still land on it, handled
        // gracefully by MissingRoutine (see e2e/navigation.spec.ts's
        // "deleting a routine..." test). Fully collapsing every level would
        // need real navigation-depth tracking, not a fixed-depth navigate(-N)
        // (that would break the delete-from-a-direct-deep-link case) —
        // accepted as-is rather than worth that complexity for this edge case.
        navigate("/", { replace: true });
      }}
    />
  );
}
