import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Shared shell for every screen's sticky header (AppBar and home's own
// header). `fixed` (not `sticky`) so the background spans the full
// viewport edge to edge — a `sticky` element is still width-constrained by
// its normal-flow parent, which on every screen here is the centered
// w-[min(100%,480px)] content column, leaving bare page background in the
// side gutters above 480px wide. The actual content stays constrained to
// that same column via the inner wrapper below, so text/controls still
// line up with the rest of the page. Callers must add top padding to their
// own content wrapper equal to this header's rendered height (pt-27) —
// `fixed` removes it from document flow entirely, unlike `sticky`, which
// still reserves its own space. A downward box-shadow (not a gradient-fade
// div) marks the edge between the header and scrolling content underneath.
export function PageHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "bg-background fixed inset-x-0 top-0 z-10 shadow-[0_8px_16px_-4px_oklch(0_0_0/50%)]",
        className,
      )}
    >
      <div className="mx-auto flex h-27 w-[min(100%,480px)] items-center justify-between gap-4 px-5">
        {children}
      </div>
    </header>
  );
}
