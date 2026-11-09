import { z } from "zod";
import { formatIngredient } from "../../domain/recipes/ingredient";
import type { ParsedRecipeInput } from "../../domain/recipes/recipe";
import {
  type OriginalPart,
  proseOfOriginal,
  type ReadingIssue,
  type RestyleCheck,
  type RestyledPart,
  rowsInPlace,
  sentenceWithFact,
} from "../../domain/recipes/style";
import { readJsonAnswer } from "../../lib/ai";
import { AiError } from "./client";

/**
 * The answer's shape as a JSON Schema for the request's `response_format`,
 * written out for the same reason `SCRAPED_JSON_SCHEMA` is: structured output
 * wants every property named, every one required, and no extras. An
 * ingredient is answered by its number and a note, never by its words: the
 * model may move a line to another part and say how it is prepared, but has
 * nothing to rewrite its amount, unit or food with (decisions.md row 226).
 * `test/server/ai/restyle.test.ts` holds it to the zod schema.
 */
export const RESTYLE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "ingredients", "steps"],
        properties: {
          name: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["line", "note"],
              properties: { line: { type: "integer" }, note: { type: "string" } },
            },
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "text", "summary"],
              properties: {
                title: { type: "string" },
                text: { type: "string" },
                summary: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** One step as the model answers it: all three fields required, "" for the two it chose not to write. */
export const RestyledStepSchema = z.object({
  title: z.string().default(""),
  text: z.string().default(""),
  summary: z.string().default(""),
});

/** One ingredient line as the model answers it: its number in the prompt, from 1 through the whole recipe, and its note. */
export const AnsweredLineSchema = z.object({ line: z.number().int(), note: z.string().default("") });

/** One part as the model answers it. */
export const AnsweredPartSchema = z.object({
  name: z.string().default(""),
  ingredients: z.array(AnsweredLineSchema).default([]),
  steps: z.array(RestyledStepSchema).default([]),
});

/** The whole answer. Nothing else is read off it, so nothing else is declared. */
export const RestyleAnswerSchema = z.object({ parts: z.array(AnsweredPartSchema).default([]) });

export type AnsweredPart = z.infer<typeof AnsweredPartSchema>;

/** A part the restyle can read: a saved one, or one of an unsaved draft's, whose rows have no ids yet. */
export type StylablePart = ParsedRecipeInput["parts"][number];

/** A part as the prompt shows it: the name, the ingredient lines as the app renders them, and the steps as three fields each. */
export type PromptPart = { name: string; ingredients: string[]; steps: { title: string; text: string; summary: string }[] };

/**
 * The marker after an ingredient line that names its food: what a step is told
 * to call the ingredient.
 *
 * Lower cased, because the model copies the marker verbatim into the middle of
 * a sentence and a library of Title Case foods then reads as "melt Unsalted
 * Butter". Saying so in the statement did not hold on either model; the marker
 * is the one place it can be made true rather than asked for. Nothing is lost:
 * the step linker matches case-insensitively, and lower case is what a recipe
 * writes mid-sentence anyway. Pure.
 */
export function foodMarker(name: string): string {
  return `(food: ${name.trim().toLowerCase()})`;
}

/**
 * The parts as the prompt shows them. Ingredient lines are formatted the way
 * the recipe page formats them (`formatIngredient`) rather than sent as the
 * raw `originalText`, because the list the model reads should be the list the
 * household reads. A row that formats to nothing falls back to its raw line so
 * no ingredient goes unmentioned. A row with a food carries `(food: …)` after
 * it: the name a step calls the ingredient by (statement "call an ingredient
 * by its food name"), which is also the name the step linker matches on, so a
 * rewrite that obeys links better than the author's steps did. Pure.
 */
export function promptParts(parts: readonly StylablePart[]): PromptPart[] {
  return parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((row) => {
      const formatted = formatIngredient(row).trim();
      const line = formatted === "" ? row.originalText.trim() : formatted;
      return row.food ? `${line} ${foodMarker(row.food.name)}` : line;
    }),
    steps: part.steps.map((step) => ({ title: step.title, text: step.text, summary: step.summary })),
  }));
}

/** The parts with a step: a recipe with none has nothing to rewrite, and the model is not called. Pure. */
export function partsWithSteps<P extends { steps: readonly unknown[] }>(parts: readonly P[]): P[] {
  return parts.filter((part) => part.steps.length > 0);
}

/**
 * The answer as the recipe's rows: each line number turned back into the
 * row's place (from 0), and every row the answer left out put back where it
 * was — in the answered part of the same name, or, when the answer has none,
 * in a part of that name with no steps, where the recipe has it. A model asked to rebuild
 * the parts still tends to leave out a part with nothing to rewrite, and the
 * row is the author's either way, so leaving it out costs nothing it must
 * not. A line named twice, or one the recipe does not have, is a broken
 * answer: `malformed`, and nothing is changed. Pure.
 */
export function placeLines(original: readonly StylablePart[], answered: readonly AnsweredPart[]): RestyledPart[] {
  const inPlace = rowsInPlace(original);
  const count = inPlace.flat().length;
  const seen = new Set<number>();
  const parts = answered.map((part) => {
    const rows: number[] = [];
    const notes: string[] = [];
    for (const { line, note } of part.ingredients) {
      const row = line - 1;
      if (row < 0 || row >= count)
        throw new AiError("malformed", `The model named ingredient ${line}, which the recipe does not have, so nothing was changed.`);
      if (seen.has(row)) throw new AiError("malformed", `The model put ingredient ${line} in twice, so nothing was changed.`);
      seen.add(row);
      rows.push(row);
      notes.push(note);
    }
    return { name: part.name, rows, notes, steps: part.steps };
  });
  const fold = (name: string) => name.trim().toLowerCase();
  original.forEach((part, p) => {
    const missing = inPlace[p]!.filter((row) => !seen.has(row));
    if (missing.length === 0) return;
    let home = parts.find((answeredPart) => fold(answeredPart.name) === fold(part.name));
    if (home === undefined) {
      // Back where it was: before the first answered part that the recipe has after it.
      const later = new Set(original.slice(p + 1).map((after) => fold(after.name)));
      const at = parts.findIndex((answeredPart) => later.has(fold(answeredPart.name)));
      home = { name: part.name, rows: [], notes: [], steps: [] };
      parts.splice(at === -1 ? parts.length : at, 0, home);
    }
    for (const row of missing) {
      home.rows.push(row);
      home.notes.push(part.ingredients[inPlace[p]!.indexOf(row)]!.note);
    }
  });
  if (parts.length === 0) throw new AiError("malformed", "The model answered with no parts, so nothing was changed.");
  return parts;
}

/**
 * The line that is not a style statement and never becomes one: what the recipe
 * tells you is the recipe's, whatever the household's voice. It leads the
 * prompt because a model reads the top of it best, and the conservation check
 * enforces it afterwards regardless.
 *
 * It says the whole rule rather than the numbers alone because the numbers were
 * never what went missing: the lab found a rewrite that kept every quantity and
 * still turned "add sugar if the sauce is sour" into "add sugar". And it lives
 * here rather than among the statements because a guide half made of guards
 * asks for nothing — written as statements, the same words returned the recipe
 * unchanged on both models.
 */
export const FIXED_RESTYLE_LINE =
  "Temperatures, times and quantities keep their values: never converted, rounded or dropped, though how a number is written may follow the house style. Nothing else the recipe tells you may be lost either: every instruction, condition, cue, warning, shortcut, storage note and description of how to do something must still be there afterwards, including any in brackets at the end of a step. Reword, reorder and regroup freely; do not drop.";

/** How a part is headed in the prompt. The unnamed part is the main body and says so. Pure. */
function partHeading(name: string): string {
  return name.trim() === "" ? 'PART "" (the recipe\'s main body)' : `PART "${name}"`;
}

/**
 * What the model is asked. The fixed line first, then the ticked statements
 * numbered — numbered because that is how the guide is written and because a
 * numbered list is what a small model follows, and because a test can then
 * assert that statement (7) reached the prompt — then the recipe part by part.
 *
 * The rules after the statements are about the shape of the answer rather than
 * its voice: the parts as the house style lays them out — the recipe's own,
 * unchanged, when no statement says otherwise — each ingredient line placed
 * once by its number with its note, and the steps rewritten. They are separate
 * from the statements on purpose, because the statements are the household's
 * and change in Settings, while these are the contract the parser and the check
 * depend on. They also anchor the rewrite to the author's step boundaries: a
 * frame that lets steps be merged or split is read as an invitation to
 * atomise, so splitting and merging are left to the statements alone.
 *
 * Ingredient lines are numbered through the whole recipe (#1, #2, …) rather
 * than per part, because a line may move to another part and the number is
 * how the answer says which line it moved.
 * Pure.
 */
export function restylePrompt({ rules, parts }: { rules: readonly string[]; parts: readonly PromptPart[] }): string {
  const lines: string[] = [
    "Rewrite this recipe's method in the house style below, and answer with JSON matching the schema. The rewrite must do exactly what the author's method does, in the household's voice: the same dish, the same stages in the same order, the same cues, waits and warnings, so that a cook following it gets the author's result.",
    FIXED_RESTYLE_LINE,
    "",
    "HOUSE STYLE:",
  ];
  if (rules.length === 0) lines.push("(no statements are ticked: leave the steps as they are)");
  else for (const [index, rule] of rules.entries()) lines.push(`${index + 1}. ${rule}`);

  lines.push(
    "",
    "Before you write, read the original as a cook would: what the dish is, what each of the author's steps is for, every wait and when it has to start, and everything easy to lose (asides in brackets, alternatives, warnings, tips, serving notes). That is the intent the rewrite has to keep.",
    "Before you answer, read your rewrite back against the original and against each house style statement, as an editor who did not write it, and fix what you find: a step that no longer does what the author's did, or does something the author never asked; anything from the original that is missing; an instruction said twice (in two steps, or in a step and its own supporting line), though the prep step may repeat what an ingredient's note says; a step with nothing to do in it; words that do not read as a sentence, such as an ingredient note pasted in after a food (\"the water, hot\"); a statement not applied everywhere it applies, such as an imperial measure left beside its metric one, a word from another kitchen, or a step without a label.",
    "",
    "Rules for the answer:",
    "- Answer with the recipe's parts as the house style lays them out. Where no statement asks for a different layout, answer with the same parts, in the same order, with their names copied exactly as given below.",
    "- Each ingredient line has a number (#1, #2, …) through the whole recipe. Put every line in exactly one part, by its number, in the order that part lists them. A part may hold lines and no steps, or steps and no lines.",
    '- Each step is three fields. `text` is the instruction. `title` is a short label, or "" for no label. `summary` is what the step says that is not an instruction on the main path — why a time is a range, what to expect, what to do if it goes wrong — in as many sentences as it takes, or "" for none.',
    '- Each entry of a part\'s `ingredients` is `line`, the line\'s number, and `note`, saying how that ingredient is prepared ("finely diced", "at room temperature") or "" for nothing. Never change a quantity, a unit or a food: you are not given them to rewrite, only the note.',
    "- Split or merge steps only where a house style statement asks for it; otherwise keep the author's step boundaries. Everything the original said must still be said, in one of these fields.",
    '- Keep every number, temperature and time with its value and its unit. Do not convert between metric and imperial, do not round, and do not drop one; writing it differently ("2 - 2 1/2 hrs" as "2–2½ hours") is allowed.',
    "- Keep every ingredient the original steps named, called by the food name marked `(food: …)` after its ingredient line, never by the whole line.",
    "- Do not invent an ingredient, a step, a time or a quantity, and do not add advice the recipe does not give.",
    "- Steps carry no numbering of their own: one entry per step, plain sentences.",
    "- Answer with the JSON only.",
    "",
    "RECIPE:"
  );

  lines.push(...recipeLines(parts));
  return lines.join("\n");
}

/** The recipe as the prompts show it: part by part, its ingredient lines numbered through the recipe, its steps numbered within the part. Pure. */
function recipeLines(parts: readonly PromptPart[]): string[] {
  const lines: string[] = [];
  let line = 0;
  for (const part of parts) {
    lines.push("", partHeading(part.name), "INGREDIENTS:");
    if (part.ingredients.length === 0) lines.push("(none)");
    else for (const ingredient of part.ingredients) lines.push(`#${++line} ${ingredient}`);
    lines.push("STEPS:");
    if (part.steps.length === 0) lines.push("(none)");
    else for (const [index, step] of part.steps.entries()) lines.push(`${index + 1}. ${promptStep(step)}`);
  }
  return lines;
}

/**
 * What the checks found in a rewrite, said as what to do about it: the list
 * the revision is asked to work through. What the rewrite lost or invented —
 * a lost number quoted in the author's sentence, since "0.5tsp" alone was put
 * back as "salt, ½ teaspoon" — then what reads wrong. An imperial measure is left out: the fixed line
 * forbids converting one, so it is the import's to convert, not the
 * revision's, and asking would only pull the two rules against each other.
 * Pure.
 */
export function revisionProblems(check: RestyleCheck, original: readonly OriginalPart[]): string[] {
  const prose = original.flatMap(proseOfOriginal);
  const lostFact = (fact: string) => {
    const sentence = sentenceWithFact(prose, fact);
    return sentence === null
      ? `The original's “${fact}” is not in the rewrite. Put it back where the author had it.`
      : `A number from the original's “${sentence}” is not in the rewrite. Put it back, as the author wrote it, where it belongs.`;
  };
  const reading: Record<ReadingIssue["kind"], string> = {
    repeated: "Say it once, where it belongs.",
    idle: "Fold it into the step it belongs to.",
    fragment: "Write it as a sentence; the note belongs on the ingredient's line.",
    imperial: "",
    word: "Use the household's word.",
  };
  return [
    ...check.missingFacts.map(lostFact),
    ...check.missingFoods.map((food) => `The rewrite no longer names ${food} in the method. Name it where the author did.`),
    ...check.missingConditions.map((phrase) => `“${phrase}” is in the original but not in the rewrite. Put it back.`),
    ...check.addedConditions.map((phrase) => `The rewrite adds “${phrase}”, which the original never says. Take it out.`),
    ...(check.rowMismatch ? ["The rewrite does not place every ingredient line exactly once. Place each line once."] : []),
    ...check.issues.filter((issue) => issue.kind !== "imperial").map((issue) => `${issue.message} ${reading[issue.kind]}`),
  ];
}

/**
 * The second look, asked only when the checks found something in the first
 * rewrite: the original, the house style, the rewrite as the model answered
 * it, and the problems, with the instruction to fix those and leave the rest
 * alone. A fresh call reads the rewrite as something written, which the first
 * call, writing front to back, never does; and the list is what the checks
 * found rather than what the model thinks of its own work, which on the lab's
 * recipes was praise. Pure.
 */
export function revisePrompt({
  rules,
  parts,
  rewrite,
  problems,
}: {
  rules: readonly string[];
  parts: readonly PromptPart[];
  rewrite: readonly AnsweredPart[];
  problems: readonly string[];
}): string {
  return [
    "Below are a recipe, a household's house style, and a rewrite of the recipe's method in that style. An editor has checked the rewrite against the original and found the problems listed. Answer with the corrected rewrite as JSON matching the schema, in the same shape as the rewrite below.",
    "Fix every problem on the list. Change nothing else: keep the rewrite's parts, labels and wording wherever no problem touches them. The fix must keep the author's intent — the same stages, cues, waits and warnings — and the house style.",
    FIXED_RESTYLE_LINE,
    "",
    "PROBLEMS:",
    ...problems.map((problem) => `- ${problem}`),
    "",
    "HOUSE STYLE:",
    ...(rules.length === 0 ? ["(no statements are ticked)"] : rules.map((rule, index) => `${index + 1}. ${rule}`)),
    "",
    "THE ORIGINAL RECIPE:",
    ...recipeLines(parts),
    "",
    "THE REWRITE (ingredient lines by their number above):",
    JSON.stringify({ parts: rewrite }),
    "",
    "Answer with the JSON only.",
  ].join("\n");
}

/**
 * One step as the prompt shows it. A step that already carries a label or a
 * supporting line is shown with them marked, so a second restyle reads what the
 * first wrote rather than finding a sentence it cannot place. Pure.
 */
function promptStep(step: PromptPart["steps"][number]): string {
  const label = step.title.trim() === "" ? "" : `[label: ${step.title.trim()}] `;
  const support = step.summary.trim() === "" ? "" : ` [supporting line: ${step.summary.trim()}]`;
  return `${label}${step.text}${support}`;
}

/**
 * The parts out of the message content: JSON, because the request asked for
 * it, with a fence stripped for a model that fences anyway. Throws
 * `AiError("malformed", …)` for anything that is not an answer. Pure.
 */
export function parseRestyleAnswer(content: string): AnsweredPart[] {
  const read = readJsonAnswer(content, RestyleAnswerSchema, "restyle format", "nothing was changed");
  if (!read.ok) throw new AiError("malformed", read.message);
  return read.value.parts;
}
