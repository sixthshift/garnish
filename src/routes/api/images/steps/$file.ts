import { createFileRoute } from "@tanstack/react-router";
import { handleGetStepImage } from "../../../../server/stepImages";

/** GET /api/images/steps/:file — serves a stored step photo. */
export const Route = createFileRoute("/api/images/steps/$file")({
  server: {
    handlers: {
      GET: ({ params }) => handleGetStepImage(params.file),
    },
  },
});
