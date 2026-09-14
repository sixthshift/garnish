import { createRoute } from "@tanstack/react-router";
import { handleGetTimelineImage, handleUploadTimelineImage } from "../../server/api/timelineImages";
import { Route as rootRoute } from "../root";

/** GET /api/images/timeline/:file — serves a stored timeline photo. */
export const getTimelineImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/timeline/$file",
  server: {
    handlers: {
      GET: ({ params }) => handleGetTimelineImage(params.file),
    },
  },
});

/** POST /api/timeline/:id/image — multipart upload replacing a logged cook's photo. */
export const uploadTimelineImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/timeline/$id/image",
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadTimelineImage(request, params.id),
    },
  },
});
