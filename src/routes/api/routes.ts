// The server routes: HTTP endpoints for callers outside the app. Their
// handlers import the store, so routes.ts adds this list on the server only.
import { exportJsonRoute, recipeCookRoute, recipeJsonRoute } from "./export";
import { healthRoute } from "./health";
import { getImageRoute, uploadImageRoute } from "./images";
import { importFileRoute } from "./importFile";
import { getStepImageRoute, uploadStepImageRoute } from "./stepImages";
import { getTimelineImageRoute, uploadTimelineImageRoute } from "./timelineImages";

export const apiRoutes = [
  healthRoute,
  exportJsonRoute,
  recipeJsonRoute,
  recipeCookRoute,
  getImageRoute,
  uploadImageRoute,
  getStepImageRoute,
  uploadStepImageRoute,
  getTimelineImageRoute,
  uploadTimelineImageRoute,
  importFileRoute,
] as const;
