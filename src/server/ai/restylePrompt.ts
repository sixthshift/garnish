import { z } from "zod";
import { formatIngredient } from "../../domain/ingredient";
import type { Part } from "../../domain/recipe";
import type { RestyledPart } from "../../domain/style";
import { AiError, stripFence } from "./client";

/**
 * The answer's shape as a JSON Schema for the request's `response_format`,
 * written out for the same reason `SCRAPED_JSON_SCHEMA` is: structured output
 * wants every property named, every one required, and no extras. Steps only —
 * the ingredients are sent so the model knows what the pan holds, never so it
 * can rewrite them. `test/server/ai/restyle.test.ts` holds it to the zod schema.
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
        required: ["name", "steps"],
        properties: {
          name: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

/** One part as the model answers it. */
export const RestyledPartSchema = z.object({
  name: z.string().default(""),
  steps: z.array(z.string()).default([]),
});

/** The whole answer. Nothing else is read off it, so nothing else is declared. */
export const RestyleAnswerSchema = z.object({ parts: z.array(RestyledPartSchema).default([]) });
export type RestyleAnswer = z.infer<typeof RestyleAnswerSchema>;

/** A part as the prompt shows it: the name, the ingredient lines as the app renders them, and the steps. */
export type PromptPart = { name: string; ingredients: string[]; steps: string[] };

/** The marker after an ingredient line that names its food: what a step is told to call the ingredient. Pure. */
export function foodMarker(name: string): string {
  return `(food: ${name.trim()})`;
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
export function promptParts(parts: readonly Part[]): PromptPart[] {
  return parts.map((part) => ({
    name: part.name,
    ingredients: part.ingredients.map((row) => {
      const formatted = formatIngredient(row).trim();
      const line = formatted === "" ? row.originalText.trim() : formatted;
      return row.food ? `${line} ${foodMarker(row.food.name)}` : line;
    }),
    steps: part.steps.map((step) => step.text),
  }));
}

/**
 * The parts worth asking about: those with a step. An empty part (an import
 * sometimes leaves the main body with no steps when every step sits under a
 * heading) is not sent, because a model given nothing to rewrite tends to
 * leave it out of its answer, and the pairing would then fail. `withEmptyParts`
 * puts them back. Pure.
 */
export function partsWithSteps<P extends { steps: readonly unknown[] }>(parts: readonly P[]): P[] {
  return parts.filter((part) => part.steps.length > 0);
}

/**
 * The answer's parts back in the recipe's positions: `answered` pairs with the
 * parts `partsWithSteps` kept, and every empty part is spliced in as itself,
 * with no steps, so what comes out pairs with the recipe by index. An answer
 * with the wrong count for the parts that were asked is `malformed`. Pure.
 */
export function withEmptyParts(original: readonly Part[], answered: readonly RestyledPart[]): RestyledPart[] {
  const asked = partsWithSteps(original).length;
  if (answered.length !== asked) {
    throw new AiError(
      "malformed",
      `The model answered with ${answered.length} part${answered.length === 1 ? "" : "s"} where the recipe has ${asked} with steps, so nothing was changed.`
    );
  }
  let next = 0;
  return original.map((part) => (part.steps.length === 0 ? { name: part.name, steps: [] } : answered[next++]!));
}

/**
 * The line that is not a style statement and never becomes one: the facts are
 * the recipe's, whatever the household's voice. It leads the prompt because a
 * model reads the top of it best, and the facts check enforces it afterwards regardless.
 */
export const FIXED_RESTYLE_LINE = "Temperatures, times and quantities are copied exactly, never converted, rounded or dropped.";

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
 * its voice: the same parts, in the same order, under the same names, with the
 * steps rewritten and nothing else touched. They are separate from the
 * statements on purpose, because the statements are the household's and change
 * in Settings, while these are the contract the parser and the check depend on.
 * They also anchor the rewrite to the author's step boundaries: told that
 * steps "may be merged or split", every model tried turned seven steps into
 * twenty, so splitting and merging are left to the statements alone.
 * Pure.
 */
export function restylePrompt({ rules, parts }: { rules: readonly string[]; parts: readonly PromptPart[] }): string {
  const lines: string[] = [
    "Rewrite this recipe's method in the house style below, and answer with JSON matching the schema.",
    FIXED_RESTYLE_LINE,
    "",
    "HOUSE STYLE:",
  ];
  if (rules.length === 0) lines.push("(no statements are ticked: leave the steps as they are)");
  else for (const [index, rule] of rules.entries()) lines.push(`${index + 1}. ${rule}`);

  lines.push(
    "",
    "Rules for the answer:",
    "- Answer with the same parts, in the same order, with their names copied exactly as given below. Do not add, drop, merge, rename or reorder a part.",
    "- Rewrite `steps` only. The ingredient lines are shown so you know what is used and what it is called; never answer with them, and never change a quantity, a unit or an ingredient.",
    "- Split or merge steps only where a house style statement asks for it; otherwise keep the author's step boundaries. Everything the original steps said must still be said.",
    "- Keep every number, temperature and time exactly as written, including its unit. Do not convert between metric and imperial, do not round, and do not drop one.",
    "- Keep every ingredient the original steps named, called by the food name marked `(food: …)` after its ingredient line, never by the whole line.",
    "- Do not invent an ingredient, a step, a time or a quantity, and do not add advice the recipe does not give.",
    "- Steps carry no numbering of their own: one entry per step, plain sentences.",
    "- Answer with the JSON only.",
    "",
    "RECIPE:"
  );

  for (const part of parts) {
    lines.push("", partHeading(part.name), "INGREDIENTS:");
    if (part.ingredients.length === 0) lines.push("(none)");
    else for (const line of part.ingredients) lines.push(`- ${line}`);
    lines.push("STEPS:");
    if (part.steps.length === 0) lines.push("(none)");
    else for (const [index, step] of part.steps.entries()) lines.push(`${index + 1}. ${step}`);
  }

  return lines.join("\n");
}

/**
 * The parts out of the message content: JSON, because the request asked for
 * it, with a fence stripped for a model that fences anyway. Throws
 * `AiError("malformed", …)` for anything that is not an answer. Pure.
 */
export function parseRestyleAnswer(content: string): RestyledPart[] {
  const raw = stripFence(content);
  if (raw === "") throw new AiError("malformed", "The model answered with nothing.");

  let answer: unknown;
  try {
    answer = JSON.parse(raw);
  } catch {
    throw new AiError("malformed", "The model answered in prose rather than the restyle format, so nothing was changed.");
  }

  const parsed = RestyleAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${first.path.join(".")}: ${first.message})` : "";
    throw new AiError("malformed", `The model's answer was not in the expected shape${where}. Nothing was changed.`);
  }
  return parsed.data.parts;
}

/**
 * The answer's parts against the recipe's. `checkRestyle` pairs by index and
 * throws rather than failing on a mismatch, because a mismatch is not a bad
 * rewrite but a broken answer — so it is caught here first and reported as
 * `malformed`, in words the sheet can show. Names are compared trimmed and
 * case-insensitively: a model that title-cases a heading has still answered
 * about the right part. Pure.
 */
export function matchParts(original: readonly Part[], restyled: readonly RestyledPart[]): void {
  if (original.length !== restyled.length) {
    throw new AiError(
      "malformed",
      `The model answered with ${restyled.length} part${restyled.length === 1 ? "" : "s"} where the recipe has ${original.length}, so nothing was changed.`
    );
  }
  const fold = (name: string) => name.trim().toLowerCase();
  for (const [index, part] of original.entries()) {
    const answered = restyled[index]!;
    if (fold(part.name) !== fold(answered.name)) {
      throw new AiError("malformed", `The model renamed a part ("${part.name}" came back as "${answered.name}"), so nothing was changed.`);
    }
  }
}
