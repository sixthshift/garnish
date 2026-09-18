// What the planner asks the model for a week's proposal and how it reads the
// answer (M39.3): the fixed lines, the week's slots, the statements, what was
// eaten lately and the library as one line per recipe. Pure — no IO, no model
// call, and no date computed here: the caller passes `today`.

import { z } from "zod";
import { stripFence } from "../../lib/ai";
import type { Meal } from "./meals";

/** Why a proposal did not happen. One kind so far; `AiError`'s other kinds are the server's to map on (M39.4). */
export type ProposalFailure = "malformed";

/** A proposal that never became one: the model answered with something that is not a week. Never a partial write; nothing is written by the proposal at all. */
export class ProposalError extends Error {
  readonly kind: ProposalFailure;
  constructor(kind: ProposalFailure, message: string) {
    super(message);
    this.name = "ProposalError";
    this.kind = kind;
  }
}

/** One recipe as the prompt shows it: everything a statement might weigh, and nothing else. */
export type LibraryRecipe = {
  id: string;
  name: string;
  tags: string[];
  totalMinutes: number | null;
  rating: number | null;
  favourite: boolean;
  /** The last time it was planned or cooked, `YYYY-MM-DD`, or null for never. */
  lastMade: string | null;
};

/** Something eaten lately: the last four weeks of the plan and of logged cooks, merged and sorted by the caller. */
export type RecentMeal = { date: string; name: string };

/** One meal of one day of the week being planned. `taken` is the name of what is already there, or null when the slot is open. */
export type ProposalSlot = { date: string; meal: Meal; taken: string | null };

/** Everything a proposal is built from. Gathered on the server (M39.4), read here. */
export type ProposalInput = {
  /** Today, `YYYY-MM-DD`, from the caller's clock. */
  today: string;
  week: { monday: string; dates: string[] };
  meals: Meal[];
  slots: ProposalSlot[];
  /** The enabled statements of the planner guide, in order. */
  rules: string[];
  library: LibraryRecipe[];
  recent: RecentMeal[];
};

/**
 * The most recipes worth sending. The library line is what fits: a prompt of
 * every recipe a household will ever own is mostly text the model reads past,
 * and a long list dilutes the statements that are supposed to choose from it.
 * Past this, `libraryForPrompt` sorts the favourites and the highest rated to
 * the front and the prompt says the list was cut.
 */
export const MAX_LIBRARY_LINES = 500;

/**
 * The answer's shape as a JSON Schema for the request's `response_format`,
 * written out for the same reason `SCRAPED_JSON_SCHEMA` is: structured output
 * wants every property named, every one required, and no extras.
 * `test/domain/planner/proposal.test.ts` holds it to the zod twin below so the
 * two cannot drift.
 */
export const PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entries"],
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "meal", "recipeId", "reason"],
        properties: {
          date: { type: "string" },
          meal: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          recipeId: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * One line of the answer as it arrives. `meal` is a plain string rather than
 * the enum: a model that answers "supper" has filled no slot, and that is a
 * line for `checkProposal` to drop with a reason rather than a reason to throw
 * the whole week away.
 */
export const ProposalAnswerEntrySchema = z.object({
  date: z.string().default(""),
  meal: z.string().default(""),
  recipeId: z.string().default(""),
  reason: z.string().default(""),
});
export type ProposalAnswerEntry = z.infer<typeof ProposalAnswerEntrySchema>;

/** The whole answer. Nothing else is read off it, so nothing else is declared. */
export const ProposalAnswerSchema = z.object({ entries: z.array(ProposalAnswerEntrySchema).default([]) });
export type ProposalAnswer = z.infer<typeof ProposalAnswerSchema>;

/** A line the check kept: its slot's date and meal, so what comes out of the check is a slot rather than a guess. */
export type ProposalEntry = { date: string; meal: Meal; recipeId: string; reason: string };

/** The fixed line that is not a statement and never becomes one: where the household is. The month is left for the model to read, so the prompt does not need a table of seasons. */
export const FIXED_PLACE_LINE = "This household is in Australia: the southern hemisphere, so read the month below for the season.";

/**
 * The recipes the prompt shows, and whether the list was cut. Under the cap
 * the library goes as given, in the caller's order; past it the favourites
 * come first, then the highest rated, then the rest, because those are the
 * ones the statements lean on. Pure.
 */
export function libraryForPrompt(library: readonly LibraryRecipe[]): { recipes: LibraryRecipe[]; cut: boolean } {
  if (library.length <= MAX_LIBRARY_LINES) return { recipes: [...library], cut: false };
  const ranked = [...library].sort((a, b) => {
    if (a.favourite !== b.favourite) return a.favourite ? -1 : 1;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
  return { recipes: ranked.slice(0, MAX_LIBRARY_LINES), cut: true };
}

/** One recipe as the model reads it: `id | name | tags | 35 min | ★4 | fav | last 2026-08-30`. Absent facts are left out rather than sent as null, except that a recipe never made says so. Pure. */
export function libraryLine(recipe: LibraryRecipe): string {
  const fields = [recipe.id, recipe.name, recipe.tags.join(", ")];
  if (recipe.totalMinutes !== null) fields.push(`${recipe.totalMinutes} min`);
  if (recipe.rating !== null) fields.push(`★${recipe.rating}`);
  if (recipe.favourite) fields.push("fav");
  fields.push(recipe.lastMade === null ? "never made" : `last ${recipe.lastMade}`);
  return fields.join(" | ");
}

/** One slot as the model reads it. A taken slot is named so the week reads as a whole; only the open ones are answered. Pure. */
export function slotLine(slot: ProposalSlot): string {
  return slot.taken === null ? `${slot.date} ${slot.meal} — OPEN` : `${slot.date} ${slot.meal} — TAKEN: ${slot.taken}`;
}

/** The rules for the answer's shape, separate from the household's statements for the same reason the restyle's are: these are the contract the check depends on, and they do not change in Settings. */
const ANSWER_RULES = [
  "- Answer with one recipe for every slot marked OPEN below, and never two for the same slot. A slot is a date and a meal.",
  "- Copy a slot's date and meal into the answer exactly as they are written below.",
  "- A slot marked TAKEN is already planned. It is shown so you can read the week as a whole; never answer for one.",
  "- `recipeId` must be an id from the LIBRARY below, copied exactly. Never invent an id, and never name a recipe that is not in the library.",
  "- A recipe may appear once in the week, unless a statement below allows leftovers.",
  '- `reason` is one short sentence to the household, in plain words, saying what about the recipe or the week chose it: "not made since June", "quick for a Tuesday", "asparagus is in season", "a favourite you have not had lately". Never refer to a statement by its position or number; say what it asks for.',
  "- Answer with the JSON only.",
];

/**
 * What the model is asked. The fixed lines first — the date and the
 * hemisphere, which are facts of the run rather than statements, so nobody can
 * switch them off — then the week's slots, then the rules for the answer, then
 * the household's statements as a plain list in the guide's order — not
 * numbered, because a numbered list is what the model cites back ("statement
 * 5"), which means nothing on the sheet — then what was eaten lately, then the
 * library. Pure.
 */
export function proposalPrompt(input: ProposalInput): string {
  const { recipes, cut } = libraryForPrompt(input.library);
  const lines: string[] = [
    "Propose meals for the week below, and answer with JSON matching the schema.",
    `Today is ${input.today}.`,
    FIXED_PLACE_LINE,
    `The week begins Monday ${input.week.monday}. The days being planned are ${input.week.dates.join(", ")}.`,
    `The meals being planned are ${input.meals.length === 0 ? "none" : input.meals.join(", ")}.`,
    "",
    "WEEK:",
  ];
  if (input.slots.length === 0) lines.push("(no slots)");
  else for (const slot of input.slots) lines.push(slotLine(slot));

  lines.push("", "Rules for the answer:", ...ANSWER_RULES, "", "HOUSE STATEMENTS:");
  if (input.rules.length === 0) lines.push("(no statements are on: choose sensibly and vary the week)");
  else for (const rule of input.rules) lines.push(`- ${rule}`);

  lines.push("", "RECENT (what was eaten lately, most of a month back):");
  if (input.recent.length === 0) lines.push("(nothing recorded)");
  else for (const meal of input.recent) lines.push(`${meal.date}  ${meal.name}`);

  lines.push("", "LIBRARY (id | name | tags | time | rating | fav | last made):");
  if (cut) {
    lines.push(`(the library holds ${input.library.length} recipes and was cut to ${MAX_LIBRARY_LINES}: favourites and the highest rated first)`);
  }
  if (recipes.length === 0) lines.push("(the library is empty)");
  else for (const recipe of recipes) lines.push(libraryLine(recipe));

  return lines.join("\n");
}

/**
 * The proposed entries out of the message content: JSON, because the request
 * asked for it, with a fence stripped for a model that fences anyway. Throws
 * `ProposalError("malformed", …)` for anything that is not an answer; a bad
 * *line* is not malformed, it is `checkProposal`'s to drop. Pure.
 */
export function parseProposalAnswer(content: string): ProposalAnswerEntry[] {
  const raw = stripFence(content);
  if (raw === "") throw new ProposalError("malformed", "The model answered with nothing.");

  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new ProposalError("malformed", "The model answered in prose rather than the proposal format, so no week was proposed.");
  }

  const parsed = ProposalAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new ProposalError("malformed", `The model's answer was not in the expected shape${where}. No week was proposed.`);
  }
  return parsed.data.entries;
}
