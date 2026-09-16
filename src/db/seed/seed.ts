import type { Database } from "bun:sqlite";
import { type Recipe, recipeInputSchema } from "../../domain/recipe";
import { slugify } from "../../lib/names";
import { orm } from "../connection/client";
import { recipeRepository } from "../models/recipe/repo";
import { type StyleRule, styleRuleRepository } from "../models/style/repo";
import { timelineRepository } from "../models/timeline/repo";
import { type Unit, unitRepository } from "../models/unit/repo";
import { SAMPLE_RECIPES } from "./recipes";
import { DEFAULT_STYLE_RULES } from "./style";
import { SAMPLE_TIMELINE } from "./timeline";
import { DEFAULT_UNITS } from "./units";

export type SeedResult = { units: Unit[]; styleRules: StyleRule[]; rewordedStyleRules: StyleRule[]; retiredStyleRules: StyleRule[] };

/**
 * Insert any default unit not already present (name compared
 * case-insensitively) and any house style statement whose text is not already
 * there (compared the same way). Runs in one transaction. Returns only the rows
 * created or reworded on this run, so the CLI and the tests can say what a run
 * actually did.
 *
 * A statement the household has edited no longer matches its seeded text and so
 * comes back as a new row on the next start; that is the trade the text-match
 * makes, and it is the same one the units seed makes with a renamed unit. A
 * statement that was deleted outright returns for the same reason, at the foot
 * of the guide, where it can be switched off. The one exception is a sentence
 * this project has itself reworded or folded into another: a row still
 * carrying an old sentence (listed in the statement's `was`) is given the new
 * one in place, keeping the household's switch and order, and any further old
 * sentence the same statement absorbed is removed, since what it said is now
 * said there. A rewording here is a fix rather than a new statement.
 */
export function seed(db: Database): SeedResult {
  const unitRepo = unitRepository(db);
  const styleRepo = styleRuleRepository(db);
  return orm(db).transaction((): SeedResult => {
    const existingUnits = new Set(unitRepo.list().map((u) => u.name.toLowerCase()));
    const madeUnits: Unit[] = [];
    for (const input of DEFAULT_UNITS) {
      if (existingUnits.has(input.name.toLowerCase())) continue;
      madeUnits.push(unitRepo.create(input));
    }

    const fold = (text: string) => text.trim().toLowerCase();
    const existingRules = new Map(styleRepo.list().map((r) => [fold(r.text), r]));
    const madeRules: StyleRule[] = [];
    const rewordedRules: StyleRule[] = [];
    const retiredRules: StyleRule[] = [];
    for (const input of DEFAULT_STYLE_RULES) {
      const olds = (input.was ?? []).flatMap((text) => existingRules.get(fold(text)) ?? []);
      if (!existingRules.has(fold(input.text))) {
        const first = olds.shift();
        if (first === undefined) {
          madeRules.push(styleRepo.create({ text: input.text, enabled: input.enabled, position: input.position }));
        } else {
          const reworded = styleRepo.update(first.id, { text: input.text });
          if (reworded !== null) rewordedRules.push(reworded);
        }
      }
      for (const old of olds) if (styleRepo.remove(old.id)) retiredRules.push(old);
    }

    return { units: madeUnits, styleRules: madeRules, rewordedStyleRules: rewordedRules, retiredStyleRules: retiredRules };
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
