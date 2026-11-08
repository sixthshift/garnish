import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../routes/root";
import { handleGetImage, handleUploadStepImage } from "../../../../server/api/images";

/** GET /api/images/steps/:file — serves a stored step photo. */
export const getStepImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/steps/$file",
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetImage("step", params.file, request),
    },
  },
});

/** POST /api/recipes/:id/steps/:stepId/image — multipart upload replacing a step's photo. */
export const uploadStepImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/recipes/$id/steps/$stepId/image",
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadStepImage(request, params.id, params.stepId),
    },
  },
});
