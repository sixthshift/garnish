import { createFileRoute } from "@tanstack/react-router";
import { handleUploadImage } from "../../../../server/api/images";

/** POST /api/recipes/:id/image — multipart upload replacing the recipe's image. */
export const Route = createFileRoute("/api/recipes/$id/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadImage(request, params.id),
    },
  },
});
