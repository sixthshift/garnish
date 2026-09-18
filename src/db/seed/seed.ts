import type { Database } from "bun:sqlite";
import { type Recipe, recipeInputSchema } from "../../domain/recipe";
import { slugify } from "../../lib/names";
import { orm } from "../connection/client";
import { type PlannerRule, plannerRepository } from "../models/planner/repo";
import { recipeRepository } from "../models/recipe/repo";
import { type StyleRule, styleRuleRepository } from "../models/style/repo";
import { timelineRepository } from "../models/timeline/repo";
import { type Unit, unitRepository } from "../models/unit/repo";
import { DEFAULT_PLANNER_RULES } from "./planner";
import { SAMPLE_RECIPES } from "./recipes";
import { seedStatements } from "./statements";
import { DEFAULT_STYLE_RULES } from "./style";
import { SAMPLE_TIMELINE } from "./timeline";
import { DEFAULT_UNITS } from "./units";

export type SeedResult = {
  units: Unit[];
  styleRules: StyleRule[];
  rewordedStyleRules: StyleRule[];
  retiredStyleRules: StyleRule[];
  plannerRules: PlannerRule[];
  rewordedPlannerRules: PlannerRule[];
  retiredPlannerRules: PlannerRule[];
};

/**
 * Insert any default unit not already present (name compared
 * case-insensitively), and any statement of the two guides — the house style
 * and the planner — that is not already there. Both guides go through the same
 * `seedStatements` helper, which owns the match-by-text and `was` logic and is
 * documented there. Runs in one transaction. Returns only the rows created,
 * reworded or retired on this run, so the CLI and the tests can say what a run
 * actually did.
 *
 * The planner's three meal rows are not seeded here: the migration writes
 * them, because a meal is a fixed row rather than a statement a household may
 * add to.
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

    const style = seedStatements(styleRepo, DEFAULT_STYLE_RULES);
    const plan = seedStatements(planner.rules, DEFAULT_PLANNER_RULES);

    return {
      units: madeUnits,
      styleRules: style.made,
      rewordedStyleRules: style.reworded,
      retiredStyleRules: style.retired,
      plannerRules: plan.made,
      rewordedPlannerRules: plan.reworded,
      retiredPlannerRules: plan.retired,
    };
  });
}

export type SampleResult = { recipes: Recipe[] };

/**
 * Insert every sample recipe whose slug is not already taken, through the
 * recipe repository, in one transaction. Returns only the recipes created on
 * this run. Units, foods and tags the samples name are matched to existing
 * rows case-insensitively and created when missing, so this works with or
 * without the units seed (the CLI runs that first).
 *
 * A newly created recipe named in SAMPLE_TIMELINE also gets its "made this"
 * events, which pulls its `lastMade` up to the latest one.
 */
export function seedSample(db: Database): SampleResult {
  const repo = recipeRepository(db);
  const events = timelineRepository(db);
  const created = orm(db).transaction((): Recipe[] => {
    const made: Recipe[] = [];
    for (const doc of SAMPLE_RECIPES) {
      if (repo.get(slugify(doc.name)) !== null) continue;
      const recipe = repo.create(recipeInputSchema.parse(doc));
      const inputs = SAMPLE_TIMELINE[doc.name];
      if (!inputs) {
        made.push(recipe);
        continue;
      }
      for (const input of inputs) events.create(recipe.id, input);
      made.push(repo.get(recipe.slug)!);
    }
    return made;
  });
  return { recipes: created };
}
