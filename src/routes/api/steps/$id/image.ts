import { createFileRoute } from "@tanstack/react-router";
import { handleUploadStepImage } from "../../../../server/stepImages";

/** POST /api/steps/:id/image — multipart upload replacing a step's photo. */
export const Route = createFileRoute("/api/steps/$id/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadStepImage(request, params.id),
    },
  },
});
