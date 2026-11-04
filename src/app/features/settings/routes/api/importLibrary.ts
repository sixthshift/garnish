import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../../routes/root";
import { handleImportLibrary } from "../../../../../server/api/importFile";

/** POST /api/import/library — a whole Mealie or Tandoor export, every recipe saved; `?check=1` only counts. */
export const importLibraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/import/library",
  server: {
    handlers: {
      POST: ({ request }) => handleImportLibrary(request),
    },
  },
});
