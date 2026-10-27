import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { DiagnosticEvent } from "../../db/models/diagnostic/repo";
import type { PlannerRule } from "../../domain/planner";
import type { RecipeSummary } from "../../domain/recipe";
import type { Aisle, FoodPack, TagUsage, Unit } from "../../domain/reference";
import type { StyleRule } from "../../domain/style";
import type { AiStatus } from "../../server/ai/client";
import { getAiStatus } from "../../server/fns/ai";
import { listAisles } from "../../server/fns/aisles";
import { listDiagnostics } from "../../server/fns/diagnostics";
import { listFoodPacks, listFoods, listFoodUsage } from "../../server/fns/foods";
import { getMcpStatus, type McpStatus } from "../../server/fns/mcp";
import { listPlannerRules } from "../../server/fns/planner";
import { listRecipes } from "../../server/fns/recipes";
import { listStyleRules } from "../../server/fns/style";
import { listTagUsage } from "../../server/fns/tags";
import { listUnits } from "../../server/fns/units";
import { Route as rootRoute } from "../root";

/** The repository's food row: a flat `aisleId`, not the recipe document's nested aisle. */
export type FoodRow = Awaited<ReturnType<typeof listFoods>>[number];

export type SettingsData = {
  aisles: Aisle[];
  units: Unit[];
  foods: FoodRow[];
  /** Recipes per food id; a food no recipe uses is absent. */
  foodUsage: Record<string, number>;
  /** Every food's sizes, for the food sheet's "Sold in" (decisions.md row 184). */
  foodPacks: FoodPack[];
  tags: TagUsage[];
  recipes: RecipeSummary[];
  styleRules: StyleRule[];
  plannerRules: PlannerRule[];
  ai: AiStatus;
  mcp: McpStatus;
  diagnostics: DiagnosticEvent[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, foodUsage, foodPacks, tags, recipes, styleRules, plannerRules, ai, mcp, diagnostics] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listFoodUsage(),
      listFoodPacks(),
      listTagUsage(),
      // For the food sheet's "Made by a recipe".
      listRecipes({ data: { sort: "name", dir: "asc" } }),
      listStyleRules(),
      listPlannerRules(),
      getAiStatus(),
      getMcpStatus(),
      listDiagnostics(),
    ]);
    return {
      aisles,
      units,
      foods,
      foodUsage: Object.fromEntries(foodUsage.map((row) => [row.foodId, row.recipes])),
      foodPacks,
      tags,
      recipes,
      styleRules,
      plannerRules,
      ai,
      mcp,
      diagnostics,
    };
  },
  component: lazyRouteComponent(() => import("./page"), "SettingsPage"),
});
