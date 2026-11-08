import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../routes/root";
import { handleGetImage, handleUploadImage } from "../../../../server/api/images";

/** GET /api/images/:file — serves a stored recipe image. */
export const getImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/$file",
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetImage("recipe", params.file, request),
    },
  },
});

/** POST /api/recipes/:id/image — multipart upload replacing the recipe's image. */
export const uploadImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/recipes/$id/image",
  server: {
    handlers: {
      POST: ({ request, params }) => handleUploadImage(request, params.id),
    },
  },
});
