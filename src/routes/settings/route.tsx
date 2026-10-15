import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { DiagnosticEvent } from "../../db/models/diagnostic/repo";
import type { PlannerRule } from "../../domain/planner";
import type { RecipeSummary } from "../../domain/recipe";
import type { Aisle, TagUsage, Unit } from "../../domain/reference";
import type { StyleRule } from "../../domain/style";
import type { AiStatus } from "../../server/ai/client";
import { getAiStatus } from "../../server/fns/ai";
import { listAisles } from "../../server/fns/aisles";
import { listDiagnostics } from "../../server/fns/diagnostics";
import { listFoods } from "../../server/fns/foods";
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
  tags: TagUsage[];
  recipes: RecipeSummary[];
  styleRules: StyleRule[];
  plannerRules: PlannerRule[];
  ai: AiStatus;
  diagnostics: DiagnosticEvent[];
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  loader: async (): Promise<SettingsData> => {
    const [aisles, units, foods, tags, recipes, styleRules, plannerRules, ai, diagnostics] = await Promise.all([
      listAisles({ data: {} }),
      listUnits({ data: {} }),
      listFoods({ data: {} }),
      listTagUsage(),
      // For the food sheet's "Made by a recipe".
      listRecipes({ data: { sort: "name", dir: "asc" } }),
      listStyleRules(),
      listPlannerRules(),
      getAiStatus(),
      listDiagnostics(),
    ]);
    return { aisles, units, foods, tags, recipes, styleRules, plannerRules, ai, diagnostics };
  },
  component: lazyRouteComponent(() => import("./page"), "SettingsPage"),
});
