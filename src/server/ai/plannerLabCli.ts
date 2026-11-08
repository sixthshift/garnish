// `bun run propose [--week <monday>] [--days mon,tue] [--meals breakfast,dinner] [--model <a,b>] [--rules <file>] [--prompt]`:
// build a week's proposal from the live database, on one or more models, and print each one's table. Nothing is written.

import { planRepository } from "../../db/models/plan/repo";
import { plannerRepository } from "../../db/models/planner/repo";
import { recipeRepository } from "../../db/models/recipe/repo";
import { timelineRepository } from "../../db/models/timeline/repo";
import { todayIso } from "../../domain/plan/plan";
import { proposalPrompt } from "../../domain/plan/planner";
import { modelFor } from "./client";
import { openLabDb, rulesFromText } from "./lab";
import { proposalInput } from "./planner";
import { daysFlag, LAB_USAGE, parseLabFlags, runLab, weekMondayFlag } from "./plannerLab";
import ai from "./provider";

if (import.meta.main) {
  const flags = parseLabFlags(process.argv.slice(2), modelFor("planner"));
  const db = await openLabDb(LAB_USAGE);
  try {
    const today = todayIso();
    const monday = weekMondayFlag(flags.week, today);
    const dates = daysFlag(flags.days, monday);

    const rules = flags.rulesFile === null ? undefined : rulesFromText(await Bun.file(flags.rulesFile).text());
    const repos = { plan: planRepository(db), planner: plannerRepository(db), recipes: recipeRepository(db), timeline: timelineRepository(db) };
    const input = proposalInput({ monday, dates, meals: flags.meals, rules }, repos);
    const { slots, meals } = input;

    const open = slots.filter((slot) => slot.taken === null).length;
    console.log(`# Week of ${monday}  (${input.rules.length} statements, ${dates.length} days, ${meals.join(", ")}, ${open} open slots)`);

    if (flags.showPrompt) {
      console.log("", proposalPrompt(input), "");
    } else {
      for (const line of await runLab(input, flags.models, ai)) console.log(line);
    }
  } finally {
    db.close();
  }
}
