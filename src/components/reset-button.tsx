import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn, FIXED_ACTION_SHADOW } from "@/lib/utils";

// Shared "look" for the reset (routine-detail.tsx) and reset-all
// (routine-list.tsx) buttons, which had drifted apart in disabled styling
// and spacing despite both being the same kind of action. Disabled state is
// a blurred, translucent background rather than a flat muted color or a
// dimmed opacity — both buttons float over scrollable content, and the
// blur reads clearly as "inactive" while still showing what's behind it.
export function ResetButton({
  disabled,
  onClick,
  className,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "disabled:bg-background/40 disabled:text-muted-foreground min-h-13 rounded-lg px-4.5 disabled:opacity-100 disabled:backdrop-blur-md",
        FIXED_ACTION_SHADOW,
        className,
      )}
    >
      {children}
    </Button>
  );
}
