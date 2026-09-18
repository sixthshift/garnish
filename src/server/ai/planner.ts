// The proposal read (M39.4): the restyle's shape over the planner's pure half.
// `proposalInput` gathers the week — the library, the open slots, what was
// eaten lately and the statements that are on — and `runProposal` asks the
// model once and hands back the checked week. Nothing is written here; the
// household accepts a proposal before `applyPlanProposal` (src/server/fns/planner.ts)
// writes a single row.

import plan from "../../db/models/plan/repo";
import planner from "../../db/models/planner/repo";
import recipes from "../../db/models/recipe/repo";
import timeline from "../../db/models/timeline/repo";
import { addDays, entryLabel, type PlanDay, todayIso } from "../../domain/plan";
import {
  checkProposal,
  enabledMeals,
  enabledRules,
  type LibraryRecipe,
  type Meal,
  PROPOSAL_JSON_SCHEMA,
  type ProposalCheck,
  ProposalError,
  type ProposalInput,
  type ProposalSlot,
  parseProposalAnswer,
  proposalPrompt,
  type RecentMeal,
} from "../../domain/planner";
import type { RecipeSummary } from "../../domain/recipe";
import { AI_TIMEOUT_MS, AiError, type AiRunner, aiSettings, createFetchRunner, type Fetcher } from "./client";

export { AiError } from "./client";

/** How far back "what we just ate" reaches: four weeks of plan and of logged cooks before the week being planned. */
export const RECENT_DAYS = 28;

/** Which model proposes, where, and with what key: the import's settings with `AI_PLANNER_MODEL` over the model. */
export function plannerSettings(): { apiKey: string; baseUrl: string; model: string } {
  const settings = aiSettings();
  const model = (process.env.AI_PLANNER_MODEL ?? "").trim();
  return model === "" ? settings : { ...settings, model };
}

/** The runner used in anger here: the client's runner, told to ask for the proposal schema and this model. */
export const plannerRunner: AiRunner = (prompt, timeoutMs) =>
  createFetchRunner(fetch, { schema: PROPOSAL_JSON_SCHEMA, schemaName: "proposal", model: plannerSettings().model })(prompt, timeoutMs);

/** The same runner over an injected `fetch`, so the HTTP path can be driven without a provider. */
export function createPlannerRunner(fetcher: Fetcher = fetch): AiRunner {
  return createFetchRunner(fetcher, {
    schema: PROPOSAL_JSON_SCHEMA,
    schemaName: "proposal",
    model: plannerSettings().model,
  });
}

/**
 * One proposal: one prompt, one answer, parsed and checked against the slots
 * and the library it was built from. The result is returned whether or not
 * lines were dropped, because a proposal with one bad line is still a proposal
 * (`checkProposal`); only an answer that is not a week at all fails, and it
 * fails as `AiError("malformed")` so the screen reads it the way it reads the
 * import's and the restyle's failures. Nothing is written.
 */
export async function runProposal(input: ProposalInput, options: { run?: AiRunner } = {}): Promise<ProposalCheck> {
  const { run = plannerRunner } = options;
  // A week with nothing open has nothing to propose, and the model is not called.
  if (!input.slots.some((slot) => slot.taken === null)) return { entries: [], dropped: [], unfilled: [] };

  let content: string;
  try {
    content = await run(proposalPrompt(input), AI_TIMEOUT_MS);
  } catch (cause) {
    if (cause instanceof AiError) throw cause;
    throw new AiError("failed", `The model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  try {
    const answer = parseProposalAnswer(content);
    return checkProposal(answer, { slots: input.slots, libraryIds: input.library.map((recipe) => recipe.id) });
  } catch (cause) {
    // The domain's own failure, carried across the boundary as the client's, the way the importer carries its errors.
    if (cause instanceof ProposalError) throw new AiError(cause.kind, cause.message);
    throw cause;
  }
}

// --- The gathering ---------------------------------------------------------

/** A summary as the prompt shows it: tags by name, and `last_made` as the calendar day rather than the timestamp. Pure. */
export function libraryRecipe(summary: RecipeSummary): LibraryRecipe {
  return {
    id: summary.id,
    name: summary.name,
    tags: summary.tags.map((tag) => tag.name),
    totalMinutes: summary.totalTime,
    rating: summary.rating,
    favourite: summary.favourite,
    lastMade: summary.lastMade === null ? null : summary.lastMade.slice(0, 10),
  };
}

/**
 * The week's slots: every `(date, meal)` pair of the days being planned and
 * the meals that are on. A slot is taken when the day already holds an entry
 * of that meal — an untyped entry blocks nothing, because a day holding a
 * snack or a side is not a day with its dinner decided. Pure.
 */
export function weekSlots(days: readonly PlanDay[], dates: readonly string[], meals: readonly Meal[]): ProposalSlot[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const slots: ProposalSlot[] = [];
  for (const date of dates) {
    const entries = byDate.get(date)?.entries ?? [];
    for (const meal of meals) {
      const already = entries.find((entry) => entry.meal === meal);
      slots.push({ date, meal, taken: already === undefined ? null : entryLabel(already) || "something" });
    }
  }
  return slots;
}

/** Plan entries and logged cooks merged, newest first, one line per date and name. Pure. */
export function mergeRecent(planned: readonly RecentMeal[], cooked: readonly RecentMeal[]): RecentMeal[] {
  const seen = new Set<string>();
  return [...planned, ...cooked]
    .filter((meal) => {
      const key = `${meal.date} ${meal.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Everything a proposal is built from, read off the database: the library, the
 * week's open and taken slots, what was eaten in the four weeks before this
 * one, the statements that are on, and today from the clock. The four weeks
 * come from four `week` reads rather than a range query, because the week is
 * the plan's unit and four of them is the whole of "recently".
 */
export function proposalInput({ monday, dates }: { monday: string; dates: string[] }): ProposalInput {
  const meals = enabledMeals(planner.meals.list());
  const rules = enabledRules(planner.rules.list()).map((rule) => rule.text);
  const library = recipes.query().map(libraryRecipe);
  const slots = weekSlots(plan.week(monday), dates, meals);

  const since = addDays(monday, -RECENT_DAYS);
  const planned: RecentMeal[] = [];
  for (let back = RECENT_DAYS; back > 0; back -= 7) {
    for (const day of plan.week(addDays(monday, -back))) {
      for (const entry of day.entries) {
        if (entry.recipe !== null) planned.push({ date: day.date, name: entry.recipe.name });
      }
    }
  }

  return {
    today: todayIso(),
    week: { monday, dates },
    meals,
    slots,
    rules,
    library,
    recent: mergeRecent(planned, timeline.recent(since)),
  };
}
