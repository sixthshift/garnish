// `bun run restyle <recipe>`: try the house style on one recipe, from the author's steps, on one or more models, and print the rewrite. Nothing is written.

import { recipeRepository } from "../../db/models/recipe/repo";
import { styleRuleRepository } from "../../db/models/style/repo";
import type { Recipe } from "../../domain/recipes/recipe";
import { modelFor } from "./client";
import { eachModel, openLabDb, rulesFromText } from "./lab";
import ai from "./provider";
import { runRestyle } from "./restyle";
import { authorRecipe, LAB_USAGE, onlyPart, parseLabFlags, reportLines } from "./restyleLab";
import { partsWithSteps, promptParts, restylePrompt } from "./restylePrompt";

if (import.meta.main) {
  const flags = parseLabFlags(process.argv.slice(2), modelFor("restyle"));
  const db = await openLabDb(LAB_USAGE);
  try {
    const recipes = recipeRepository(db);
    const byName = recipes.query({ by: "name", name: flags.recipe })[0];
    const found: Recipe | null = recipes.get(flags.recipe) ?? recipes.getById(flags.recipe) ?? (byName ? recipes.getById(byName.id) : null);
    if (found === null) throw new Error(`No recipe "${flags.recipe}" by slug, id or name.`);

    const rules =
      flags.rulesFile === null
        ? styleRuleRepository(db)
            .list()
            .filter((rule) => rule.enabled)
            .map((rule) => rule.text)
        : rulesFromText(await Bun.file(flags.rulesFile).text());
    const recipe = onlyPart(authorRecipe(found, recipes.ref(found.id).authorSteps()), flags.part);

    console.log(`# ${found.name}  (${rules.length} statements, ${recipe.parts.length} parts, ${partsWithSteps(recipe.parts).length} with steps)`);
    if (flags.showPrompt) console.log("", restylePrompt({ rules, parts: promptParts(recipe.parts) }), "");

    const lines = await eachModel(
      flags.models,
      (model) => runRestyle(recipe, rules, { ai, model }),
      (model, seconds, result) => reportLines(model, seconds, recipe, result)
    );
    console.log(lines.join("\n"));
  } finally {
    db.close();
  }
}
