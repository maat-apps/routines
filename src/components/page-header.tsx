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
// own content wrapper equal to this header's rendered height (h-17, plus
// whatever gap they want) — `fixed` removes it from document flow
// entirely, unlike `sticky`, which still reserves its own space.
export function PageHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("bg-background fixed inset-x-0 top-0 z-10", className)}
    >
      <div className="mx-auto flex h-17 w-[min(100%,480px)] items-center justify-between gap-4 px-5 py-2.5">
        {children}
      </div>
      {/* Always rendered (no JS scroll listener) — content scrolling
          underneath fades out instead of stopping at a hard edge. */}
      <div
        aria-hidden="true"
        className="from-background pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b to-transparent"
      />
    </header>
  );
}
