import { createFileRoute } from "@tanstack/react-router";
import { handleImportFile } from "../../../server/importFile";

/** POST /api/import/file — multipart upload of a Mealie or Tandoor export, parsed for the review step (M34.3, M34.4). */
export const Route = createFileRoute("/api/import/file")({
  server: {
    handlers: {
      POST: ({ request }) => handleImportFile(request),
    },
  },
});
