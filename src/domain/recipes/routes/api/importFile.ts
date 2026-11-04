import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../routes/root";
import { handleImportFile } from "../../../../server/api/importFile";

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
