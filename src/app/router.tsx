import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

const HomeView = lazy(() =>
  import("@/views/home/home-view").then((m) => ({ default: m.HomeView })),
);
const NewRoutineView = lazy(() =>
  import("@/views/new/new-routine-view").then((m) => ({
    default: m.NewRoutineView,
  })),
);
const RoutineView = lazy(() =>
  import("@/views/routine/routine-view").then((m) => ({
    default: m.RoutineView,
  })),
);
const RoutineEditView = lazy(() =>
  import("@/views/routine-edit/routine-edit-view").then((m) => ({
    default: m.RoutineEditView,
  })),
);

// GitHub Pages has no server-side rewrites, so a copy of the built index.html is
// published as 404.html (see vite.config.ts) — that's what lets a hard refresh or
// deep link into any of these paths still boot the app and land on the right view.
// Each view is its own chunk (see the lazy() calls above), so a visit only ever
// downloads the screen it needs.
export function AppRouter() {
  return (
    // BASE_URL (not a hardcoded "/routines") so a PR preview built under
    // "/routines/pr-<n>/" (see vite.config.ts) routes correctly there too.
    // BrowserRouter's basename has no trailing slash; BASE_URL always does.
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/new" element={<NewRoutineView />} />
          <Route path="/routine/:id" element={<RoutineView />} />
          <Route path="/routine/:id/edit" element={<RoutineEditView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
