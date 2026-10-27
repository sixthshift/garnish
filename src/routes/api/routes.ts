// The server routes (/api/*), added to the tree on the server only: their handlers import the store.

import { backupZipRoute, restoreRoute } from "./backup";
import { recipeCookRoute, recipeJsonRoute } from "./export";
import { healthRoute } from "./health";
import { getImageRoute, uploadImageRoute } from "./images";
import { importFileRoute } from "./importFile";
import {
  authorizationServerRoute,
  authorizeRoute,
  mcpRoute,
  protectedResourceRootRoute,
  protectedResourceRoute,
  registerRoute,
  revokeRoute,
  tokenRoute,
} from "./mcp";
import { getStepImageRoute, uploadStepImageRoute } from "./stepImages";
import { getTimelineImageRoute, uploadTimelineImageRoute } from "./timelineImages";

export const apiRoutes = [
  healthRoute,
  recipeJsonRoute,
  recipeCookRoute,
  getImageRoute,
  uploadImageRoute,
  getStepImageRoute,
  uploadStepImageRoute,
  getTimelineImageRoute,
  uploadTimelineImageRoute,
  importFileRoute,
  backupZipRoute,
  restoreRoute,
  mcpRoute,
  protectedResourceRoute,
  protectedResourceRootRoute,
  authorizationServerRoute,
  authorizeRoute,
  tokenRoute,
  registerRoute,
  revokeRoute,
] as const;
