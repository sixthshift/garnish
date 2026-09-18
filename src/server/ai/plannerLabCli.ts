// `bun run propose [--week <monday>] [--days mon,tue] [--model <a,b>] [--rules <file>] [--prompt]`:
// build a week's proposal from the live database, on one or more models, and print each one's table. Nothing is written.

import { databasePath, openDatabase } from "../../db/connection/open";
import { planRepository } from "../../db/models/plan/repo";
import { plannerRepository } from "../../db/models/planner/repo";
import { recipeRepository } from "../../db/models/recipe/repo";
import { timelineRepository } from "../../db/models/timeline/repo";
import { addDays, todayIso } from "../../domain/plan";
import { enabledMeals, PROPOSAL_JSON_SCHEMA, type ProposalInput, proposalPrompt, type RecentMeal } from "../../domain/planner";
import { ensureDataDir } from "../core/boot";
import { createFetchRunner } from "./client";
import { libraryRecipe, mergeRecent, plannerSettings, RECENT_DAYS, weekSlots } from "./planner";
import { daysFlag, LAB_USAGE, parseLabFlags, rulesFromText, runLab, weekMondayFlag } from "./plannerLab";

if (import.meta.main) {
  const flags = parseLabFlags(process.argv.slice(2), plannerSettings().model);
  const path = databasePath(ensureDataDir());
  // Never create the database here: an empty one would answer "no such table". The app or `bun run seed` builds it.
  if (!(await Bun.file(path).exists())) throw new Error(`No database at ${path}. Start the app or run \`bun run seed\` first. ${LAB_USAGE}`);
  const db = openDatabase(path);
  try {
    const today = todayIso();
    const monday = weekMondayFlag(flags.week, today);
    const dates = daysFlag(flags.days, monday);

    const plan = planRepository(db);
    const planner = plannerRepository(db);
    const recipes = recipeRepository(db);
    const timeline = timelineRepository(db);

    const meals = enabledMeals(planner.meals.list());
    const rules =
      flags.rulesFile === null
        ? planner.rules
            .list()
            .filter((rule) => rule.enabled)
            .map((rule) => rule.text)
        : rulesFromText(await Bun.file(flags.rulesFile).text());
    const library = recipes.query().map(libraryRecipe);
    const slots = weekSlots(plan.week(monday), dates, meals);

    // Four weeks back of what was eaten, the same reach `proposalInput` (src/server/ai/planner.ts) uses: read here rather than
    // through it, since that function's gathering runs over the app's default-export repositories, opened only through
    // `getDb()`'s bundled migrations — a plain `bun run` script builds its own handle instead, as every other CLI here does.
    const since = addDays(monday, -RECENT_DAYS);
    const planned: RecentMeal[] = [];
    for (let back = RECENT_DAYS; back > 0; back -= 7) {
      for (const day of plan.week(addDays(monday, -back))) {
        for (const entry of day.entries) {
          if (entry.recipe !== null) planned.push({ date: day.date, name: entry.recipe.name });
        }
      }
    }

    const input: ProposalInput = {
      today,
      week: { monday, dates },
      meals,
      slots,
      rules,
      library,
      recent: mergeRecent(planned, timeline.recent(since)),
    };

    const open = slots.filter((slot) => slot.taken === null).length;
    console.log(`# Week of ${monday}  (${rules.length} statements, ${dates.length} days, ${open} open slots)`);

    if (flags.showPrompt) {
      console.log("", proposalPrompt(input), "");
    } else {
      const runnerFor = (model: string) => createFetchRunner(fetch, { schema: PROPOSAL_JSON_SCHEMA, schemaName: "proposal", model });
      for (const line of await runLab(input, flags.models, runnerFor)) console.log(line);
    }
  } finally {
    db.close();
  }
}
