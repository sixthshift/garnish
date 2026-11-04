// The server routes (/api/*), added to the tree on the server only: their handlers import the store.
// Each section keeps its own in its routes/api/ (recipes', settings'); here they
// are put together with the app's own beside this file: health and the MCP
// connector's door.

import { settingsApiRoutes } from "../../app/features/settings/routes/api";
import { recipesApiRoutes } from "../../domain/recipes/routes/api";
import { healthRoute } from "./health";
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
export const restRoutes = [
  healthRoute,
  ...recipesApiRoutes,
  ...settingsApiRoutes,
  mcpRoute,
  protectedResourceRoute,
  protectedResourceRootRoute,
  authorizationServerRoute,
  authorizeRoute,
  tokenRoute,
  registerRoute,
  revokeRoute,
] as const;
