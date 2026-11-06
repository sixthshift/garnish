import { tidyPartName } from "../scraped/parts";
import { decodeEntities } from "../scraped/text";
import type { ScrapedPart, ScrapedRecipe } from "../scraped/types";
import { attributesOf, TAG, VOID_TAGS } from "./microdata";

// A recipe card's ingredient groups (decisions.md row 204). schema.org's
// `recipeIngredient` is one flat list, so a page's "For the sauce" never
// reaches the JSON-LD; WP Recipe Maker, the most common WordPress recipe
// plugin, draws it in the card's markup the same way on every site:
//
//   div.wprm-recipe-ingredients-container
//     div.wprm-recipe-ingredient-group
//       h4.wprm-recipe-group-name         (absent for the main body)
//       ul > li.wprm-recipe-ingredient     (span.wprm-recipe-ingredient-name inside)
//
// The plugin writes the JSON-LD from the same list in the same order, so the
// groups are laid over its lines by count, and checked line by line by name.

/** One group as the card draws it: its heading, how many lines it holds, and each line's food name. */
export type IngredientGroup = { name: string; foods: string[] };

const CONTAINER = "wprm-recipe-ingredients-container";
const GROUP = "wprm-recipe-ingredient-group";
const GROUP_NAME = "wprm-recipe-group-name";
const ITEM = "wprm-recipe-ingredient";
const ITEM_NAME = "wprm-recipe-ingredient-name";

/** Text as the card shows it: entities decoded, whitespace collapsed. Pure. */
function clean(text: string): string {
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

/**
 * The first recipe card's ingredient groups, in order, or null when the page
 * has no WP Recipe Maker card. A card with one unnamed group is still a card:
 * it says the list has no groups. Pure.
 */
export function ingredientGroups(html: string): IngredientGroup[] | null {
  const stack: string[] = [];
  const groups: IngredientGroup[] = [];
  let container = -1;
  // What the text between tags is being collected for, and the depth that ends it.
  let capture: { into: "name" | "food"; depth: number; text: string } | null = null;
  let last = 0;

  const current = (): IngredientGroup => {
    if (groups.length === 0) groups.push({ name: "", foods: [] });
    return groups[groups.length - 1]!;
  };

  for (const match of html.matchAll(TAG)) {
    if (capture !== null) capture.text += html.slice(last, match.index);
    last = match.index + match[0].length;
    const closing = match[1] === "/";
    const tag = match[2]!.toLowerCase();

    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      if (capture !== null && stack.length <= capture.depth) {
        const text = clean(capture.text.replace(/<[^>]*>/g, " "));
        if (capture.into === "name") current().name = text;
        else {
          const foods = current().foods;
          foods[foods.length - 1] = text;
        }
        capture = null;
      }
      if (container >= 0 && stack.length <= container) break;
      continue;
    }

    const classes = (attributesOf(match[3] ?? "").get("class") ?? "").split(/\s+/);
    // A list item the page left open is closed by the next one.
    if (tag === "li" && stack[stack.length - 1] === "li") stack.pop();
    const depth = stack.length;
    if (!VOID_TAGS.has(tag) && match[4] !== "/") stack.push(tag);

    if (container < 0) {
      if (classes.includes(CONTAINER)) container = depth;
      continue;
    }
    if (classes.includes(GROUP)) groups.push({ name: "", foods: [] });
    else if (classes.includes(GROUP_NAME)) capture = { into: "name", depth, text: "" };
    else if (classes.includes(ITEM)) current().foods.push("");
    else if (classes.includes(ITEM_NAME) && capture === null) capture = { into: "food", depth, text: "" };
  }
  if (container < 0) return null;
  return groups.filter((group) => group.foods.length > 0);
}

/** A part name as a key: tidied, case ignored. Pure. */
function key(name: string): string {
  return tidyPartName(name).toLowerCase();
}

/** Whether a line is the one the card drew: its food name is in it, case and spacing ignored. Pure. */
function sameLine(line: string, food: string): boolean {
  const name = clean(food).toLowerCase();
  return name === "" || clean(line).toLowerCase().includes(name);
}

/**
 * The recipe with the card's groups as its ingredients' parts, and whether the
 * page placed everything: every named group has a step section of its own, by
 * name, and no section is left over. Null when the groups add nothing (no named group) or do not
 * agree with the JSON-LD (another count, a line naming another food): the
 * recipe is then read exactly as it was. Steps stay in the sections the
 * JSON-LD gave them; a section named as a group is that group's part. Pure.
 */
export function withIngredientGroups(recipe: ScrapedRecipe, groups: readonly IngredientGroup[]): { recipe: ScrapedRecipe; complete: boolean } | null {
  if (!groups.some((group) => group.name !== "")) return null;
  const lines = recipe.parts.flatMap((part) => part.ingredients);
  if (groups.reduce((sum, group) => sum + group.foods.length, 0) !== lines.length) return null;

  let at = 0;
  const grouped: ScrapedPart[] = [];
  for (const group of groups) {
    const own = lines.slice(at, at + group.foods.length);
    at += group.foods.length;
    if (!own.every((line, i) => sameLine(line, group.foods[i]!))) return null;
    grouped.push({ name: tidyPartName(group.name), ingredients: own, steps: [] });
  }

  // The JSON-LD's step sections, by name: one named as a group joins it, the rest stay their own parts.
  const sections = recipe.parts.filter((part) => part.steps.length > 0);
  const taken = new Set<ScrapedPart>();
  for (const part of grouped) {
    const section = sections.find((candidate) => !taken.has(candidate) && key(candidate.name) === key(part.name));
    if (section === undefined) continue;
    part.steps = [...section.steps];
    taken.add(section);
  }
  const rest = sections.filter((section) => !taken.has(section)).map((section) => ({ ...section, ingredients: [] }));
  // The main body's own steps, when no group took them, lead as the main body does.
  const main = rest.filter((section) => section.name === "");
  const parts = [...main, ...grouped, ...rest.filter((section) => section.name !== "")];

  // Placed by the page alone: every named group has steps of its own, and no section was left over.
  const complete = rest.length === 0 && grouped.every((part) => part.name === "" || part.steps.length > 0);
  return { recipe: { ...recipe, parts }, complete };
}
