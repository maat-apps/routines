import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { RoutineEditForm } from "@/components/routine-edit-form";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRoutines } from "@/hooks/use-store";
import { useTranslation } from "@/i18n/use-translation";
import { createId } from "@/lib/routine-utils";
import { saveRoutine } from "@/lib/storage";
import type { Routine } from "@/types";

export function NewRoutineView() {
  const navigate = useNavigate();
  const smartBack = useSmartBack("/");
  const { t } = useTranslation();
  const routines = useRoutines();
  const [routine, setRoutine] = useState<Routine | null>(null);

  useEffect(() => {
    const newRoutine: Routine = {
      id: createId(),
      name: "",
      order: routines.length,
      steps: [],
    };
    startTransition(() => setRoutine(newRoutine));
    // Only seed the draft once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!routine) return null;
  return (
    <RoutineEditForm
      routine={routine}
      title={t("newRoutineTitle")}
      onBack={() => startTransition(smartBack)}
      onSave={saveRoutine}
      onComplete={() =>
        startTransition(() =>
          navigate(`/routine?id=${encodeURIComponent(routine.id)}`, {
            replace: true,
          }),
        )
      }
      onDelete={() => startTransition(() => navigate("/"))}
      showDelete={false}
    />
  );
}
