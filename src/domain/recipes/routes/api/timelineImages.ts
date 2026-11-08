import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../routes/root";
import { handleGetImage, handleUploadTimelineImage } from "../../../../server/api/images";

/** GET /api/images/timeline/:file — serves a stored timeline photo. */
export const getTimelineImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/timeline/$file",
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetImage("timeline", params.file, request),
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
