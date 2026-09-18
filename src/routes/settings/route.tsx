import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { PlannerMeal, PlannerRule } from "../../domain/planner";
import type { RecipeSummary } from "../../domain/recipe";
import type { Aisle, Tag, Unit } from "../../domain/reference";
import type { StyleRule } from "../../domain/style";
import { listAisles } from "../../server/fns/aisles";
import { listFoods } from "../../server/fns/foods";
import { listPlannerMeals, listPlannerRules } from "../../server/fns/planner";
import { listRecipes } from "../../server/fns/recipes";
import { listStyleRules } from "../../server/fns/style";
import { listTags } from "../../server/fns/tags";
import { listUnits } from "../../server/fns/units";
import { Route as rootRoute } from "../root";

/** The repository's food row: a flat `aisleId`, not the recipe document's nested aisle. */
export type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type SettingsData = {
  aisles: Aisle[];
  units: Unit[];
  foods: FoodRow[];
  tags: Tag[];
  recipes: RecipeSummary[];
  styleRules: StyleRule[];
  plannerRules: PlannerRule[];
  plannerMeals: PlannerMeal[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, tags, recipes, styleRules, plannerRules, plannerMeals] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listTags({ data: {} }),
      // For the food sheet's "Made by a recipe".
      listRecipes({ data: { sort: "name", dir: "asc" } }),
      listStyleRules(),
      listPlannerRules(),
      listPlannerMeals(),
    ]);
    return { aisles, units, foods, tags, recipes, styleRules, plannerRules, plannerMeals };
  },
  component: lazyRouteComponent(() => import("./page"), "SettingsPage"),
});
