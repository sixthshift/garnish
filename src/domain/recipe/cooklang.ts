// Cooklang export (M34.2): a recipe document as a `.cook` file.
//
// Borrows the shapes the Cooklang spec (https://cooklang.org/docs/spec/)
// defines, not the incumbents' file format: a metadata block of `>> key:
// value` lines, an `== Part ==` heading per named part (the unnamed part is
// the body and gets no heading), an ingredient a step links written inline as
// `@food{quantity%unit}` (`@multi word food{}` needs the braces to know where
// the name ends; a single word does not, when there is nothing in the braces
// to write), a fixed quantity as `{=quantity%unit}`, and a timer found by
// `durationsIn` written as `~{quantity%unit}`.
//
// A step's text is free prose, not guaranteed to name every ingredient it
// links (decisions.md row 64's links are set by hand or by `suggestLinks`'s
// guess, not parsed back out of the words). Where the food's name (or a
// plural or alias — `foodNames` from `./stepIngredients`) is found in the
// text, that span becomes the `@` reference in place; where it is not found,
// the reference is appended to the line, so a linked food is never dropped
// from the file. Timers are found the same way, over whatever text is left
// once ingredient spans are marked off, so a duration inside a matched food
// name (unlikely, but "5 minute steak") is never claimed twice.
//
// Pure: no IO, importable by the client — the same module the export route
// and the recipe menu's "Copy as Cooklang" both call.
import { durationsIn } from "./durations";
import type { Food, Ingredient, Part, Recipe, Step, Unit } from "./recipe";
import { foodNames } from "./stepIngredients";

/** Letters and digits: anything else counts as a word boundary. Mirrors stepIngredients.ts's own. */
const WORD = /[\p{L}\p{N}]/u;

function isBoundary(character: string | undefined): boolean {
  return character === undefined || !WORD.test(character);
}

function markConsumed(consumed: boolean[], from: number, to: number): void {
  for (let i = from; i < to; i += 1) consumed[i] = true;
}

function anyConsumed(consumed: boolean[], from: number, to: number): boolean {
  for (let i = from; i < to; i += 1) if (consumed[i]) return true;
  return false;
}

/** The first free, word-bounded span naming `food` in `text` (case-insensitive), or null. Longest name first. */
function findFoodSpan(text: string, food: Food, consumed: boolean[]): { start: number; end: number } | null {
  const haystack = text.toLowerCase();
  const names = foodNames(food).sort((a, b) => b.length - a.length);
  for (const name of names) {
    let from = 0;
    while (from <= haystack.length - name.length) {
      const at = haystack.indexOf(name, from);
      if (at === -1) break;
      const end = at + name.length;
      if (isBoundary(haystack[at - 1]) && isBoundary(haystack[end]) && !anyConsumed(consumed, at, end)) {
        return { start: at, end };
      }
      from = at + 1;
    }
  }
  return null;
}

/** A quantity for Cooklang: plain decimal, never a vulgar fraction glyph. "" for null, 0 or non-finite. */
function cooklangQuantity(quantity: number | null): string {
  if (quantity === null || !Number.isFinite(quantity) || quantity === 0) return "";
  return Number(quantity.toFixed(2)).toString();
}

/** A unit for Cooklang: the abbreviation when the food would show one, else the singular name. "" for none. */
function cooklangUnit(unit: Unit | null): string {
  if (unit === null) return "";
  if (unit.useAbbreviation && unit.abbreviation.trim() !== "") return unit.abbreviation;
  return unit.name;
}

/** The `{...}` an ingredient contributes: quantity, `%unit`, `=` prefix when fixed. "" when there is nothing to say. */
function amountBody(ingredient: Pick<Ingredient, "quantity" | "unit" | "fixed">): string {
  const quantity = cooklangQuantity(ingredient.quantity);
  const unit = cooklangUnit(ingredient.unit);
  if (quantity === "" && unit === "") return "";
  const prefix = ingredient.fixed ? "=" : "";
  const inside = unit === "" ? `${prefix}${quantity}` : `${prefix}${quantity}%${unit}`;
  return `{${inside}}`;
}

/** `@food{quantity%unit}` for a linked ingredient row. Braces are added even when empty for a multi-word name. */
function foodReference(ingredient: Ingredient): string {
  const name = ingredient.food!.name.trim();
  const body = amountBody(ingredient);
  const multiWord = /\s/.test(name);
  if (body === "") return multiWord ? `@${name}{}` : `@${name}`;
  return `@${name}${body}`;
}

/** `~{quantity%unit}` for a duration `durationsIn` found, in whichever of hours, minutes or seconds reads as a whole number. */
function timerToken(seconds: number): string {
  if (seconds > 0 && seconds % 3600 === 0) return `~{${seconds / 3600}%hours}`;
  if (seconds > 0 && seconds % 60 === 0) return `~{${seconds / 60}%minutes}`;
  return `~{${seconds}%seconds}`;
}

/**
 * One step's text with its linked ingredients and its durations turned into
 * Cooklang tokens. Pure.
 */
export function cooklangStepText(step: Pick<Step, "text" | "ingredientIds">, ingredients: ReadonlyMap<string, Ingredient>): string {
  const text = step.text;
  const consumed = new Array<boolean>(text.length).fill(false);
  const spans: Array<{ start: number; end: number; replacement: string }> = [];
  const appended: string[] = [];

  for (const id of step.ingredientIds) {
    const ingredient = ingredients.get(id);
    if (!ingredient || ingredient.food === null) continue;
    const reference = foodReference(ingredient);
    const span = findFoodSpan(text, ingredient.food, consumed);
    if (span) {
      spans.push({ ...span, replacement: reference });
      markConsumed(consumed, span.start, span.end);
    } else {
      appended.push(reference);
    }
  }

  for (const duration of durationsIn(text)) {
    if (anyConsumed(consumed, duration.start, duration.end)) continue;
    spans.push({ start: duration.start, end: duration.end, replacement: timerToken(duration.seconds) });
    markConsumed(consumed, duration.start, duration.end);
  }

  spans.sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += text.slice(cursor, span.start) + span.replacement;
    cursor = span.end;
  }
  result += text.slice(cursor);

  return [result, ...appended].join(" ").trim();
}

/** A named part as `== Name ==` followed by its steps; the unnamed part is just its steps. Empty when the part has no steps. */
function cooklangPart(part: Part): string {
  const ingredients = new Map(part.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const stepLines = part.steps.map((step) => cooklangStepText(step, ingredients)).filter((line) => line !== "");
  if (stepLines.length === 0) return "";
  const body = stepLines.join("\n\n");
  const name = part.name.trim();
  return name === "" ? body : `== ${name} ==\n\n${body}`;
}

/** Metadata lines: servings, source, tags. Only the ones the recipe has. */
function cooklangMetadata(recipe: Pick<Recipe, "recipeServings" | "sourceUrl" | "tags">): string[] {
  const lines: string[] = [];
  if (recipe.recipeServings > 0) lines.push(`>> servings: ${cooklangQuantity(recipe.recipeServings)}`);
  if (recipe.sourceUrl !== null && recipe.sourceUrl.trim() !== "") lines.push(`>> source: ${recipe.sourceUrl.trim()}`);
  if (recipe.tags.length > 0) lines.push(`>> tags: ${recipe.tags.map((tag) => tag.name).join(", ")}`);
  return lines;
}

/**
 * A recipe as a `.cook` file: the metadata block, then each part in order.
 * Pure. Ends with a trailing newline, as a text file does.
 */
export function toCooklang(recipe: Recipe): string {
  const metadata = cooklangMetadata(recipe).join("\n");
  const body = recipe.parts.map(cooklangPart).filter((section) => section !== "").join("\n\n");
  return `${[metadata, body].filter((section) => section !== "").join("\n\n")}\n`;
}
