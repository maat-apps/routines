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
        // replace, not a plain push: this screen is also reachable by a
        // direct deep link/hard refresh with no "routine"/"home" entries
        // behind it in this session (routine-crud.spec.ts's delete test
        // covers exactly that), so a fixed-depth back() would be unsafe —
        // replace at least ensures the *current* entry becomes home rather
        // than adding yet another push, regardless of how this view was
        // reached. It doesn't collapse an earlier "routine" entry that may
        // still be behind it (a subsequent back tap from home could still
        // land there, showing MissingRoutine — a real gap, tracked in
        // .claude/tasks/features/verify-back-button-behavior.md rather
        // than papered over here).
        navigate("/", { replace: true });
      }}
    />
  );
}
