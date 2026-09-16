import { createRoute } from "@tanstack/react-router";
import { handleGetStepImage, handleUploadStepImage } from "../../server/api/stepImages";
import { Route as rootRoute } from "../root";

/** GET /api/images/steps/:file — serves a stored step photo. */
export const getStepImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/steps/$file",
  server: {
    handlers: {
      GET: ({ params }) => handleGetStepImage(params.file),
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
