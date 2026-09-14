import { createFileRoute } from "@tanstack/react-router";
import { handleGetImage } from "../../../server/api/images";

/** GET /api/images/:file — serves a stored recipe image. */
export const Route = createFileRoute("/api/images/$file")({
  server: {
    handlers: {
      GET: ({ params }) => handleGetImage(params.file),
    },
  },
});
