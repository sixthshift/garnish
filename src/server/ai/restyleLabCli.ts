// `bun run restyle <recipe>`: try the house style on one recipe, from the author's steps, on one or more models, and print the rewrite. Nothing is written.

import { databasePath, openDatabase } from "../../db/connection/open";
import { recipeRepository } from "../../db/models/recipe/repo";
import { styleRuleRepository } from "../../db/models/style/repo";
import type { Recipe } from "../../domain/recipe";
import { ensureDataDir } from "../core/boot";
import { createFetchRunner } from "./client";
import { restyleSettings, runRestyle } from "./restyle";
import { authorRecipe, failureLine, onlyPart, parseLabFlags, reportLines, rulesFromText } from "./restyleLab";
import { partsWithSteps, promptParts, RESTYLE_JSON_SCHEMA, restylePrompt } from "./restylePrompt";

if (import.meta.main) {
  const flags = parseLabFlags(process.argv.slice(2), restyleSettings().model);
  const path = databasePath(ensureDataDir());
  // Never create the database here: an empty one would answer "no such table". The app or `bun run seed` builds it.
  if (!(await Bun.file(path).exists())) throw new Error(`No database at ${path}. Start the app or run \`bun run seed\` first.`);
  const db = openDatabase(path);
  try {
    const recipes = recipeRepository(db);
    const found: Recipe | null =
      recipes.get(flags.recipe) ??
      recipes.getById(flags.recipe) ??
      recipes.query({ by: "name", name: flags.recipe }).map((row) => recipes.getById(row.id))[0] ??
      null;
    if (found === null) throw new Error(`No recipe "${flags.recipe}" by slug, id or name.`);

    const rules =
      flags.rulesFile === null
        ? styleRuleRepository(db)
            .list()
            .filter((rule) => rule.enabled)
            .map((rule) => rule.text)
        : rulesFromText(await Bun.file(flags.rulesFile).text());
    const recipe = onlyPart(authorRecipe(found, recipes.ref(found.id).authorSteps()), flags.part);

    console.log(`# ${found.name}  (${rules.length} statements, ${partsWithSteps(recipe.parts).length} parts with steps)`);
    if (flags.showPrompt) console.log("", restylePrompt({ rules, parts: promptParts(partsWithSteps(recipe.parts)) }), "");

    for (const model of flags.models) {
      const run = createFetchRunner(fetch, { schema: RESTYLE_JSON_SCHEMA, schemaName: "restyle", model });
      const started = performance.now();
      try {
        const result = await runRestyle(recipe, rules, { run });
        console.log(["", ...reportLines(model, (performance.now() - started) / 1000, recipe, result)].join("\n"));
      } catch (error) {
        console.log(["", failureLine(model, (performance.now() - started) / 1000, error)].join("\n"));
      }
    }
  } finally {
    db.close();
  }
}
