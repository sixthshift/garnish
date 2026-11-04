// The route tree: its shape, and nothing else. Each route is defined in its own
// file (a path, what it loads and validates, the page it draws), in the routes/
// folder of the section it answers for, whose index.ts puts its subtree
// together; here the subtrees are put together. Routing is still code: a
// file's name decides nothing, these lists do. Pages read their route's data
// through getRouteApi, so nothing imports a route but other routes and this.

import { settingsRoute } from "../app/features/settings/routes/settings";
import { homeRoute } from "../domain/home/routes/home";
import { planRoutes } from "../domain/plan/routes";
import { recipesRoutes } from "../domain/recipes/routes";
import { shoppingRoute } from "../domain/shopping/routes/shopping";
import { Route as rootRoute } from "./root";

// /api/* is served by the server alone: its handlers import the store, and
// the browser never routes there, it fetches. Vite fixes import.meta.env.SSR
// at build time, so the client bundle drops this branch and the modules
// behind it. The type stays the full list so both sides see one tree.
const api = import.meta.env.SSR ? (await import("../api/rest")).restRoutes : ([] as unknown as typeof import("../api/rest").restRoutes);

// In the nav's order: Home, Plan, Shopping, Recipes, Settings, each with the pages under it.
export const routeTree = rootRoute.addChildren([homeRoute, planRoutes, shoppingRoute, recipesRoutes, settingsRoute, ...api]);
