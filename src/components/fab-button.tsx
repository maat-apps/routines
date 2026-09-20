import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared shape for a floating circular/square action button (currently
// just "New routine" in routine-list.tsx, but pulled out as its own
// component rather than inlined so a second FAB doesn't quietly diverge).
export function FabButton({
  onClick,
  ariaLabel,
  className,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      size="icon-lg"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn("h-13 w-13 rounded-lg", className)}
    >
      {children}
    </Button>
  );
}
