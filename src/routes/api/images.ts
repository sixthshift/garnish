import { createRoute } from "@tanstack/react-router";
import { handleGetImage, handleUploadImage } from "../../server/api/images";
import { Route as rootRoute } from "../root";

/** GET /api/images/:file — serves a stored recipe image. */
export const getImageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/images/$file",
  server: {
    handlers: {
      GET: ({ params }) => handleGetImage(params.file),
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
