import { text } from "../../scraped/text";
import { isNode, type Node, pick } from "../json";
import { tandoorRecipe } from "./recipe";
import type { TandoorRecipe } from "./types";

/** Whether a node is a Tandoor recipe rather than a Mealie one or some other JSON. Pure. */
export function looksLikeTandoorRecipe(value: unknown): value is Node {
  if (!isNode(value)) return false;
  if (!Array.isArray(value.steps)) return false;
  if (text(pick(value, "name")).trim() === "") return false;
  const fields = ["keywords", "working_time", "waiting_time", "servings", "servings_text", "source_url", "internal", "nutrition"];
  if (fields.some((field) => field in value)) return true;
  return value.steps.some((step) => isNode(step) && ("instruction" in step || "ingredients" in step));
}

/** Whether a parsed JSON value holds Tandoor recipes at all: one, a list, or a wrapper. Pure. */
export function looksLikeTandoor(value: unknown): boolean {
  return tandoorNodes(value).length > 0;
}

/** Every Tandoor recipe node in a parsed JSON value. Pure. */
export function tandoorNodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter(looksLikeTandoorRecipe);
  if (!isNode(value)) return [];
  if (looksLikeTandoorRecipe(value)) return [value];
  for (const key of ["recipes", "data", "items"]) {
    const found = tandoorNodes(value[key]);
    if (found.length > 0) return found;
  }
  return [];
}

/** The lowercased names of the recipes an export holds: what decides a nested step's row. Pure. */
export function namesIn(recipes: readonly Node[]): Set<string> {
  const names = new Set<string>();
  for (const node of recipes) {
    const name = text(pick(node, "name")).trim().toLowerCase();
    if (name !== "") names.add(name);
  }
  return names;
}

/** Every Tandoor recipe in a parsed JSON value, each knowing which of its nested recipes came with it. Pure. */
export function tandoorRecipesFrom(value: unknown): TandoorRecipe[] {
  const found = tandoorNodes(value);
  const known = namesIn(found);
  return found.map((node) => tandoorRecipe(node, known));
}
