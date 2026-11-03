import { createRoute } from "@tanstack/react-router";
import { handleImportFile, handleImportLibrary } from "../../server/api/importFile";
import { Route as rootRoute } from "../root";

/** POST /api/import/file — multipart upload of a Mealie or Tandoor export, parsed for the review step. */
export const importFileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/import/file",
  server: {
    handlers: {
      POST: ({ request }) => handleImportFile(request),
    },
  },
});

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
