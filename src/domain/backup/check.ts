import type { z } from "zod";
import { BACKUP_VERSION, type Backup, backupEnvelopeSchema, backupSchema } from "./schema";

/** What `checkBackup` answers: the parsed backup, or every reason it cannot be restored. */
export type BackupCheck = { ok: true; backup: Backup } | { ok: false; problems: string[] };

/** A zod issue as one line: where, then what. */
function issueLine(issue: z.core.$ZodIssue): string {
  const where = issue.path.map((key) => (typeof key === "number" ? `[${key}]` : `.${String(key)}`)).join("");
  return `${where.replace(/^\./, "") || "file"}: ${issue.message}`;
}

/** Ids seen in one table, so a second row with the same id is named. */
class Table {
  readonly ids = new Set<string>();
  constructor(
    private readonly name: string,
    private readonly problems: string[]
  ) {}
  add(id: string, where: string): void {
    if (this.ids.has(id)) this.problems.push(`${where}: ${this.name} id ${id} appears twice`);
    this.ids.add(id);
  }
  has(id: string): boolean {
    return this.ids.has(id);
  }
}

/** Values that must be unique in one column, compared as the database compares them. */
function uniqueness(problems: string[], what: string, values: { value: string; where: string }[], fold = false): void {
  const seen = new Map<string, string>();
  for (const { value, where } of values) {
    const key = fold ? value.toLowerCase() : value;
    const first = seen.get(key);
    if (first) problems.push(`${where}: ${what} "${value}" is already used at ${first}`);
    else seen.set(key, where);
  }
}

/** Every reference that names an id its table does not hold, and every duplicate the database would refuse. Pure. */
export function referenceProblems(backup: Backup): string[] {
  const problems: string[] = [];
  const table = (name: string) => new Table(name, problems);
  const aisles = table("aisle");
  const units = table("unit");
  const tags = table("tag");
  const foods = table("food");
  const conversions = table("conversion");
  const recipes = table("recipe");
  const parts = table("part");
  const ingredients = table("ingredient");
  const steps = table("step");
  const notes = table("note");
  const events = table("timeline event");
  const entries = table("plan entry");
  const items = table("shopping item");
  const sources = table("shopping source");
  const styleRules = table("style rule");
  const plannerRules = table("planner rule");

  // Every id first, so a reference may point forward in the file.
  backup.aisles.forEach((row, i) => {
    aisles.add(row.id, `aisles[${i}]`);
  });
  backup.units.forEach((row, i) => {
    units.add(row.id, `units[${i}]`);
  });
  backup.tags.forEach((row, i) => {
    tags.add(row.id, `tags[${i}]`);
  });
  backup.foods.forEach((row, i) => {
    foods.add(row.id, `foods[${i}]`);
    row.conversions.forEach((c, j) => {
      conversions.add(c.id, `foods[${i}].conversions[${j}]`);
    });
  });
  backup.recipes.forEach((recipe, i) => {
    recipes.add(recipe.id, `recipes[${i}]`);
    recipe.notes.forEach((note, j) => {
      notes.add(note.id, `recipes[${i}].notes[${j}]`);
    });
    recipe.parts.forEach((part, j) => {
      parts.add(part.id, `recipes[${i}].parts[${j}]`);
      part.ingredients.forEach((row, k) => {
        ingredients.add(row.id, `recipes[${i}].parts[${j}].ingredients[${k}]`);
      });
      part.steps.forEach((step, k) => {
        steps.add(step.id, `recipes[${i}].parts[${j}].steps[${k}]`);
      });
    });
  });
  backup.timeline.forEach((row, i) => {
    events.add(row.id, `timeline[${i}]`);
  });
  backup.plan.forEach((row, i) => {
    entries.add(row.id, `plan[${i}]`);
  });
  backup.shopping.forEach((item, i) => {
    items.add(item.id, `shopping[${i}]`);
    item.sources.forEach((source, j) => {
      sources.add(source.id, `shopping[${i}].sources[${j}]`);
    });
  });
  backup.styleRules.forEach((row, i) => {
    styleRules.add(row.id, `styleRules[${i}]`);
  });
  backup.plannerRules.forEach((row, i) => {
    plannerRules.add(row.id, `plannerRules[${i}]`);
  });

  const ref = (target: Table, name: string, id: string | null, where: string) => {
    if (id !== null && !target.has(id)) problems.push(`${where}: ${name} ${id} is not in the backup`);
  };

  backup.units.forEach((unit, i) => {
    ref(units, "unit", unit.standardUnitId, `units[${i}].standardUnitId`);
  });
  backup.foods.forEach((food, i) => {
    ref(aisles, "aisle", food.aisleId, `foods[${i}].aisleId`);
    ref(recipes, "recipe", food.recipeId, `foods[${i}].recipeId`);
    food.conversions.forEach((c, j) => {
      ref(units, "unit", c.unitId, `foods[${i}].conversions[${j}].unitId`);
      ref(units, "unit", c.toUnitId, `foods[${i}].conversions[${j}].toUnitId`);
    });
    uniqueness(
      problems,
      "conversion",
      food.conversions.map((c, j) => ({ value: `${c.unitId} → ${c.toUnitId}`, where: `foods[${i}].conversions[${j}]` }))
    );
  });
  backup.recipes.forEach((recipe, i) => {
    ref(units, "unit", recipe.yieldUnitId, `recipes[${i}].yieldUnitId`);
    recipe.tagIds.forEach((tagId, j) => {
      ref(tags, "tag", tagId, `recipes[${i}].tagIds[${j}]`);
    });
    recipe.parts.forEach((part, j) => {
      const own = new Set(part.ingredients.map((row) => row.id));
      part.ingredients.forEach((row, k) => {
        const where = `recipes[${i}].parts[${j}].ingredients[${k}]`;
        ref(units, "unit", row.unitId, `${where}.unitId`);
        ref(foods, "food", row.foodId, `${where}.foodId`);
      });
      part.steps.forEach((step, k) => {
        step.ingredientIds.forEach((ingredientId, m) => {
          if (!own.has(ingredientId))
            problems.push(`recipes[${i}].parts[${j}].steps[${k}].ingredientIds[${m}]: ingredient ${ingredientId} is not in the step's part`);
        });
      });
    });
  });
  backup.timeline.forEach((event, i) => {
    ref(recipes, "recipe", event.recipeId, `timeline[${i}].recipeId`);
  });
  backup.plan.forEach((entry, i) => {
    ref(recipes, "recipe", entry.recipeId, `plan[${i}].recipeId`);
  });
  backup.shopping.forEach((item, i) => {
    ref(units, "unit", item.unitId, `shopping[${i}].unitId`);
    ref(foods, "food", item.foodId, `shopping[${i}].foodId`);
    item.sources.forEach((source, j) => {
      ref(recipes, "recipe", source.recipeId, `shopping[${i}].sources[${j}].recipeId`);
    });
  });

  // The columns the database holds unique, compared as it compares them.
  const named = (list: { name: string }[], at: string) => list.map((row, i) => ({ value: row.name, where: `${at}[${i}]` }));
  uniqueness(problems, "aisle name", named(backup.aisles, "aisles"), true);
  uniqueness(problems, "unit name", named(backup.units, "units"), true);
  uniqueness(problems, "tag name", named(backup.tags, "tags"), true);
  uniqueness(problems, "food name", named(backup.foods, "foods"), true);
  uniqueness(
    problems,
    "tag slug",
    backup.tags.map((row, i) => ({ value: row.slug, where: `tags[${i}]` }))
  );
  uniqueness(
    problems,
    "recipe slug",
    backup.recipes.map((row, i) => ({ value: row.slug, where: `recipes[${i}]` }))
  );

  return problems;
}

/**
 * Whether `json` (the parsed `garnish.json`) is a backup this garnish can
 * restore: a garnish backup, of a version it knows, matching the schema, with
 * every reference resolved and nothing the database would refuse as a
 * duplicate. Every problem is named, so the restore sheet can show them all.
 * Pure.
 */
export function checkBackup(json: unknown): BackupCheck {
  const envelope = backupEnvelopeSchema.safeParse(json);
  if (!envelope.success) return { ok: false, problems: ["This is not a garnish backup"] };
  const { version } = envelope.data.garnish;
  if (version > BACKUP_VERSION)
    return { ok: false, problems: [`This backup is from a newer garnish (backup version ${version}); update garnish before restoring it`] };

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map(issueLine) };

  const problems = referenceProblems(parsed.data);
  return problems.length > 0 ? { ok: false, problems } : { ok: true, backup: parsed.data };
}
