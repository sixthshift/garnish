import { Route as home } from "./home/route";
import { Route as plan } from "./plan/route";
import { Route as newRecipe } from "./recipes/new/route";
import { Route as cook } from "./recipes/recipe/cook/route";
import { Route as edit } from "./recipes/recipe/edit/route";
import { Route as recipe } from "./recipes/recipe/route";
import { Route as root } from "./root";
import { Route as settings } from "./settings/route";
import { Route as shopping } from "./shopping/route";

// /api/* is served by the server alone: its handlers import the store, and
// the browser never routes there, it fetches. Vite fixes import.meta.env.SSR
// at build time, so the client bundle drops this branch and the modules
// behind it. The type stays the full list so both sides see one tree.
const api = import.meta.env.SSR ? (await import("./api/routes")).apiRoutes : ([] as unknown as typeof import("./api/routes").apiRoutes);

export const routeTree = root.addChildren([home, plan, shopping, settings, newRecipe, recipe, cook, edit, ...api]);
