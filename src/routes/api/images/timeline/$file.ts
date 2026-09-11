import { createFileRoute } from "@tanstack/react-router";
import { handleGetTimelineImage } from "../../../../server/timelineImages";

/** GET /api/images/timeline/:file — serves a stored timeline photo. */
export const Route = createFileRoute("/api/images/timeline/$file")({
  server: {
    handlers: {
      GET: ({ params }) => handleGetTimelineImage(params.file),
    },
  },
});
