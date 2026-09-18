import { createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { z } from "zod";
import type { Tag, Unit } from "../../../domain/reference";
import { sharedUrl } from "../../../lib/urls";
import { aiImportAvailable } from "../../../server/fns/import";
import { listTags } from "../../../server/fns/tags";
import { listUnits } from "../../../server/fns/units";
import { Route as rootRoute } from "../../root";

export const NewRecipeSearch = z.object({
  /** Where the recipe is from. Absent shows the chooser. */
  source: z.enum(["url", "manual", "file", "paste"]).optional(),
  /** The address the URL stage opens on and reads at once; a share sheet's landing. */
  url: z.string().optional(),
  /**
   * The other two fields the manifest's `share_target` maps: Android puts a
   * browser's URL in `text` as often as in `url`. Both are read in
   * `beforeLoad` and never reach the page.
   */
  text: z.string().optional(),
  title: z.string().optional(),
});

export type NewRecipeData = { units: Unit[]; tags: Tag[]; aiAvailable: boolean };

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/new",
  validateSearch: NewRecipeSearch,
  // A share lands here as `?url=` or `?text=` (or both, or a title alone).
  // Whichever field holds the address, the page sees one shape: the URL
  // stage with `url` set. A share with no address in it falls to the chooser.
  beforeLoad: ({ search }) => {
    const isShare = search.text !== undefined || search.title !== undefined || (search.url !== undefined && search.source !== "url");
    if (!isShare) return;
    const url = sharedUrl(search);
    throw redirect({ to: "/recipes/new", search: url === null ? {} : { source: "url", url }, replace: true });
  },
  loader: async (): Promise<NewRecipeData> => {
    // Whether the AI rung can run is asked here rather than in the component,
    // so the chooser never flashes an option that is about to disappear
    //. A failed ask is "not installed": the other rungs still work.
    const [units, tags, ai] = await Promise.all([listUnits({ data: {} }), listTags({ data: {} }), aiImportAvailable().catch(() => ({ available: false }))]);
    return { units, tags, aiAvailable: ai.available };
  },
  component: lazyRouteComponent(() => import("./page"), "NewRecipePage"),
});
