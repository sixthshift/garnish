import { durationToMinutes } from "../../scraped/schemaOrg";
import { text } from "../../scraped/text";
import { parseYield } from "../../scraped/yield";
import { isNode, type Node, nodes, number, pick } from "../json";
import { partsFromMealie } from "./ingredient";
import type { MealieRecipe } from "./types";

// --- Reading values --------------------------------------------------------

/** How many minutes a Mealie time field means. Pure. */
export function mealieTimeToMinutes(value: unknown): number | null {
  // Mealie stores a free-text time: "30 Minutes", "1 Hour 30 Minutes", and an
  // ISO-8601 duration when the scraper wrote it.
  const iso = durationToMinutes(value);
  if (iso !== null) return iso;
  const raw = text(value).toLowerCase();
  if (raw === "") return null;
  let total = 0;
  const pattern = /(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
  for (const match of raw.matchAll(pattern)) {
    const amount = Number(match[1]);
    const unit = match[2] ?? "";
    if (!Number.isFinite(amount)) continue;
    if (unit.startsWith("d")) total += amount * 1440;
    else if (unit.startsWith("h")) total += amount * 60;
    else if (unit.startsWith("s")) total += amount / 60;
    else total += amount;
  }
  return total > 0 ? Math.round(total) : null;
}

/** Names out of Mealie's tag and category rows (either shape: a row, or a bare string), once each. Pure. */
export function tagNames(...lists: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const name = (isNode(entry) ? text(pick(entry, "name")) : text(entry)).trim();
      const key = name.toLowerCase();
      if (name === "" || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

// --- One recipe ------------------------------------------------------------

/** One Mealie recipe node as this app's fields. Pure. */
export function mealieRecipe(node: Node): MealieRecipe {
  const parts = partsFromMealie(nodes(pick(node, "recipeIngredient", "recipe_ingredient")), nodes(pick(node, "recipeInstructions", "recipe_instructions")));
  const yielded = parseYield(pick(node, "recipeYield", "recipe_yield"));
  const servings =
    number(pick(node, "recipeServings", "recipe_servings")) ?? number(pick(node, "recipeYieldQuantity", "recipe_yield_quantity")) ?? yielded.servings;
  const cook =
    mealieTimeToMinutes(pick(node, "performTime", "perform_time")) ??
    mealieTimeToMinutes(pick(node, "cookTime", "cook_time")) ??
    mealieTimeToMinutes(pick(node, "totalTime", "total_time"));

  return {
    source: "mealie",
    name: text(pick(node, "name")).trim(),
    description: text(pick(node, "description")).trim(),
    image: null,
    servings: servings > 0 ? servings : 0,
    yieldText: yielded.yieldText,
    prepMinutes: mealieTimeToMinutes(pick(node, "prepTime", "prep_time")),
    cookMinutes: cook,
    tags: tagNames(pick(node, "tags"), pick(node, "recipeCategory", "recipe_category", "categories")),
    parts,
    notes: nodes(pick(node, "notes")).map((note) => ({ title: text(pick(note, "title")).trim(), text: text(pick(note, "text")).trim() })),
    rating: number(pick(node, "rating")),
    sourceUrl: text(pick(node, "orgURL", "org_url", "orgUrl")).trim(),
    sourceId: text(pick(node, "id")).trim(),
  };
}

/** Whether a node is a Mealie recipe rather than some other row in a backup. Pure. */
export function looksLikeMealieRecipe(value: unknown): value is Node {
  if (!isNode(value)) return false;
  if (text(pick(value, "name")).trim() === "") return false;
  return ["recipeIngredient", "recipe_ingredient", "recipeInstructions", "recipe_instructions"].some((key) => Array.isArray(value[key]));
}
