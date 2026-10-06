import type { Database } from "bun:sqlite";
import { orm } from "../connection/client";
import type { Aisle } from "../models/aisle/repo";
import type { Food } from "../models/food/repo";
import { type PlannerRule, plannerRepository } from "../models/planner/repo";
import { type StyleRule, styleRuleRepository } from "../models/style/repo";
import { type Unit, unitRepository } from "../models/unit/repo";
import { DEFAULT_PLANNER_RULES } from "./planner";
import { seedFoodPlurals, seedStarterFoods } from "./starter";
import { seedStatements } from "./statements";
import { DEFAULT_STYLE_RULES } from "./style";
import { DEFAULT_UNITS } from "./units";

export type SeedResult = {
  units: Unit[];
  aisles: Aisle[];
  foods: Food[];
  aliasedFoods: Food[];
  /** Starter foods the plurals batch renamed, gave a plural or new aliases (`foodPlurals.ts`). */
  correctedFoods: Food[];
  styleRules: StyleRule[];
  rewordedStyleRules: StyleRule[];
  retiredStyleRules: StyleRule[];
  plannerRules: PlannerRule[];
  rewordedPlannerRules: PlannerRule[];
  retiredPlannerRules: PlannerRule[];
};

/**
 * Insert any default unit not already present (name compared
 * case-insensitively), the starter aisles and foods if this database has
 * never had them (`starter.ts`, once per database rather than on every start,
 * so a food the household deletes stays deleted), then the plurals batch
 * that corrects them, once likewise (`foodPlurals.ts`), and any statement of the two
 * guides — the house style and the planner — that is not already there. Both guides go through the same
 * `seedStatements` helper, which owns the match-by-text and `was` logic and is
 * documented there. Runs in one transaction. Returns only the rows created,
 * reworded or retired on this run, so the CLI and the tests can say what a run
 * actually did.
 *
 * The planner has nothing else to seed: which meals a week is planned for is a
 * per-run choice on the proposal sheet, remembered on the device rather than
 * in the database (decisions.md row 102).
 */
export function seed(db: Database): SeedResult {
  const unitRepo = unitRepository(db);
  const styleRepo = styleRuleRepository(db);
  const planner = plannerRepository(db);
  return orm(db).transaction((): SeedResult => {
    const existingUnits = new Set(unitRepo.list().map((u) => u.name.toLowerCase()));
    const madeUnits: Unit[] = [];
    for (const input of DEFAULT_UNITS) {
      if (existingUnits.has(input.name.toLowerCase())) continue;
      madeUnits.push(unitRepo.create(input));
    }

    const starter = seedStarterFoods(db);
    const correctedFoods = seedFoodPlurals(db);
    const style = seedStatements(styleRepo, DEFAULT_STYLE_RULES);
    const plan = seedStatements(planner.rules, DEFAULT_PLANNER_RULES);

    return {
      units: madeUnits,
      aisles: starter.aisles,
      foods: starter.foods,
      aliasedFoods: starter.aliasedFoods,
      correctedFoods,
      styleRules: style.made,
      rewordedStyleRules: style.reworded,
      retiredStyleRules: style.retired,
      plannerRules: plan.made,
      rewordedPlannerRules: plan.reworded,
      retiredPlannerRules: plan.retired,
    };
  });
}
