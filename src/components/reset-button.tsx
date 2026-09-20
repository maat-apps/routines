import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared shape for the reset (routine-detail.tsx) and reset-all
// (routine-list.tsx) buttons, which had drifted apart in disabled styling
// and spacing despite both being the same kind of action. The disabled
// blurred-background look itself lives on the base Button's outline variant
// (src/components/ui/button.tsx) — every outline button gets it, not just
// these two — so this component only adds the size/shape both share.
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
      className={cn("min-h-13 rounded-lg px-4.5", className)}
    >
      {children}
    </Button>
  );
}
