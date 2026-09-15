import { createRoute } from "@tanstack/react-router";
import { handleImportFile } from "../../server/api/importFile";
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
