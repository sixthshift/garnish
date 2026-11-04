import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { getAiStatus } from "../../../../api/rpc/ai";
import { listAisles } from "../../../../api/rpc/aisles";
import { listDiagnostics } from "../../../../api/rpc/diagnostics";
import { listFoodPacks, listFoods, listFoodUsage } from "../../../../api/rpc/foods";
import { getMcpStatus, type McpStatus } from "../../../../api/rpc/mcp";
import { listPlannerRules } from "../../../../api/rpc/planner";
import { listRecipes } from "../../../../api/rpc/recipes";
import { listStyleRules } from "../../../../api/rpc/style";
import { listTagUsage } from "../../../../api/rpc/tags";
import { listUnits } from "../../../../api/rpc/units";
import type { DiagnosticEvent } from "../../../../db/models/diagnostic/repo";
import type { PlannerRule } from "../../../../domain/plan/planner";
import type { RecipeSummary } from "../../../../domain/recipes/recipe";
import type { Aisle, FoodPack, FoodRow, TagUsage, Unit } from "../../../../domain/recipes/reference";
import type { StyleRule } from "../../../../domain/recipes/style";
import { Route as rootRoute } from "../../../../routes/root";
import type { AiStatus } from "../../../../server/ai/client";

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

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
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
  component: lazyRouteComponent(() => import("../pages/SettingsPage"), "SettingsPage"),
});
