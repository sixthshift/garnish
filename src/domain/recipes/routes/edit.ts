import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { getRecipe } from "../../../api/rpc/recipes";
import { listTags } from "../../../api/rpc/tags";
import { listUnits } from "../../../api/rpc/units";
import type { Recipe } from "../recipe";
import type { Tag, Unit } from "../reference";
import { recipe } from "./recipe";

export const EditRecipeSearch = z.object({
  servings: z.number().positive().finite().optional(),
});

export type EditRecipeData = { recipe: Recipe; units: Unit[]; tags: Tag[] };

export const recipeEdit = createRoute({
  getParentRoute: () => recipe,
  path: "edit",
  validateSearch: EditRecipeSearch,
  // A task finished with Save or Cancel: the phone tab bar steps aside (decision 143).
  staticData: { hideNav: true },
  loader: async ({ params }): Promise<EditRecipeData> => {
    const [recipe, units, tags] = await Promise.all([getRecipe({ data: { slug: params.slug } }), listUnits({ data: {} }), listTags({ data: {} })]);
    return { recipe, units, tags };
  },
  component: lazyRouteComponent(() => import("../pages/EditRecipePage"), "EditRecipePage"),
});
