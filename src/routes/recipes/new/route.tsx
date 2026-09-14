// new: the route. What the URL carries, what the loader reads, and
// the page it renders, loaded on demand. The page itself is page.tsx.
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Route as rootRoute } from "../../root";
import { z } from "zod";
import type { Tag, Unit } from "../../../domain/recipe/recipe";
import { aiImportAvailable } from "../../../server/fns/import";
import { listTags } from "../../../server/fns/tags";
import { listUnits } from "../../../server/fns/units";

export const NewRecipeSearch = z.object({
  /** Where the recipe is from. Absent shows the chooser. */
  source: z.enum(["url", "manual", "file", "paste"]).optional(),
});

export type NewRecipeData = { units: Unit[]; tags: Tag[]; aiAvailable: boolean };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/new",
  validateSearch: NewRecipeSearch,
  loader: async (): Promise<NewRecipeData> => {
    // Whether the AI rung can run is asked here rather than in the component,
    // so the chooser never flashes an option that is about to disappear
    // (M34.5). A failed ask is "not installed": the other rungs still work.
    const [units, tags, ai] = await Promise.all([
      listUnits({ data: {} }),
      listTags({ data: {} }),
      aiImportAvailable().catch(() => ({ available: false })),
    ]);
    return { units, tags, aiAvailable: ai.available };
  },
  component: lazyRouteComponent(() => import("./page"), "NewRecipePage"),
});
