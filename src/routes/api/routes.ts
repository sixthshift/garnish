// The server routes (/api/*), added to the tree on the server only: their handlers import the store.

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
