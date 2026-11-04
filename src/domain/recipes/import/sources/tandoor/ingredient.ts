import { text } from "../../scraped/text";
import { isNode, type Node, nodes, number, pick } from "../json";
import { ingredientLine } from "../mealie/ingredient";
import type { TandoorIngredient, TandoorPart } from "./types";

/** One of a step's `ingredients` rows. Pure. */
export function tandoorIngredient(node: Node): TandoorIngredient {
  const food = isNode(node.food) ? text(pick(node.food, "name")) : text(pick(node, "food"));
  const unit = isNode(node.unit) ? text(pick(node.unit, "name")) : text(pick(node, "unit"));
  const note = text(pick(node, "note")).trim();
  const original = text(pick(node, "original_text", "originalText")).trim();
  // Tandoor's `no_amount` is the row saying "some salt": the amount it stores
  // is meaningless, so it is not carried across as a quantity.
  const quantity = node.no_amount === true ? null : number(pick(node, "amount", "quantity"));
  const row: TandoorIngredient = { originalText: "", quantity, unit: unit.trim(), food: food.trim(), note, recipeName: "" };

  // A header row (`is_header`) is a heading Tandoor draws in the ingredient
  // list, not an ingredient. Its text is all there is, so it becomes a text
  // line rather than a food nobody meant to create.
  if (node.is_header === true) {
    const line = [row.food, row.note]
      .filter((piece) => piece !== "")
      .join(" ")
      .trim();
    return { ...row, quantity: null, unit: "", food: "", note: "", originalText: original === "" ? line : original };
  }
  if (row.food === "") return { ...row, originalText: original === "" ? note : original, note: "" };
  return { ...row, originalText: original === "" ? ingredientLine(row) : original };
}

/** The name of the recipe a step stands in for, or "" when it stands in for none. Pure. */
export function stepRecipeName(step: Node): string {
  const data = pick(step, "step_recipe_data", "stepRecipeData");
  if (isNode(data)) return text(pick(data, "name")).trim();
  const direct = pick(step, "step_recipe", "stepRecipe");
  if (isNode(direct)) return text(pick(direct, "name")).trim();
  return typeof direct === "string" ? direct.trim() : "";
}

/** The row a nested-recipe step becomes: a food standing for the child, or a text line naming it. Pure. */
export function subRecipeRow(name: string, inExport: boolean): TandoorIngredient {
  return {
    originalText: name,
    quantity: null,
    unit: "",
    food: inExport ? name : "",
    note: "",
    recipeName: inExport ? name : "",
  };
}

/**
 * Tandoor's steps as parts. A step's `name` names the part; steps sharing a
 * name — including the blank one, which is the unnamed main body — fall
 * together into one part, keeping their own rows and their own links. Pure.
 *
 * `known` is the lowercased names of the recipes in the same export, which is
 * what decides whether a nested-recipe step becomes a food or a text line.
 */
export function partsFromTandoor(steps: readonly Node[], known: ReadonlySet<string> = new Set()): TandoorPart[] {
  const parts: TandoorPart[] = [];
  const byName = new Map<string, TandoorPart>();
  const partFor = (name: string): TandoorPart => {
    const key = name.toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const part: TandoorPart = { name, ingredients: [], steps: [], rows: [], stepRows: [] };
    byName.set(key, part);
    parts.push(part);
    return part;
  };

  for (const step of steps) {
    const part = partFor(text(pick(step, "name")).trim());
    const mine: number[] = [];
    const add = (row: TandoorIngredient) => {
      if (row.originalText === "") return;
      mine.push(part.rows.length);
      part.rows.push(row);
      part.ingredients.push(row.originalText);
    };
    for (const row of nodes(pick(step, "ingredients"))) add(tandoorIngredient(row));
    const child = stepRecipeName(step);
    if (child !== "") add(subRecipeRow(child, known.has(child.toLowerCase())));

    const instruction = text(pick(step, "instruction")).trim();
    // The rows of a step with nothing written under it still belong to the
    // part; there is simply no step of its own to link them to.
    if (instruction === "") continue;
    part.stepRows.push(mine);
    part.steps.push(instruction);
  }

  return parts.length > 0 ? parts : [{ name: "", ingredients: [], steps: [], rows: [], stepRows: [] }];
}
