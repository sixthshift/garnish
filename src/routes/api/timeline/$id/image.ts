import { createFileRoute } from "@tanstack/react-router";
import { handleUploadTimelineImage } from "../../../../server/api/timelineImages";

/** POST /api/timeline/:id/image — multipart upload replacing a logged cook's photo. */
export const Route = createFileRoute("/api/timeline/$id/image")({
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadTimelineImage(request, params.id),
    },
  },
});
