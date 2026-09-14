// The route tree, in code. Each page folder exports its Route (createRoute,
// parented on root.tsx) and this file is the one place that lists them; the
// router (src/router.tsx) takes the tree from here. Add a page by adding it
// to the list. Start's own route generator still runs (vite.config.ts), but
// only to build the asset manifest it insists on — nothing imports its output.
import { Route as root } from "./root";
import { Route as home } from "./home/route";
import { Route as plan } from "./plan/route";
import { Route as shopping } from "./shopping/route";
import { Route as settings } from "./settings/route";
import { Route as newRecipe } from "./recipes/new/route";
import { Route as recipe } from "./recipes/recipe/route";
import { Route as cook } from "./recipes/recipe/cook/route";
import { Route as edit } from "./recipes/recipe/edit/route";

// /api/* is served by the server alone: its handlers import the store, and
// the browser never routes there, it fetches. Vite fixes import.meta.env.SSR
// at build time, so the client bundle drops this branch and the modules
// behind it. The type stays the full list so both sides see one tree.
const api = import.meta.env.SSR ? (await import("./api/routes")).apiRoutes : ([] as unknown as typeof import("./api/routes").apiRoutes);

export const routeTree = root.addChildren([home, plan, shopping, settings, newRecipe, recipe, cook, edit, ...api]);
