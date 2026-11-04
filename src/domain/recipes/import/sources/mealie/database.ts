import { text } from "../../scraped/text";
import { isNode, type Node, nodes, number, pick } from "../json";
import { looksLikeMealieRecipe, mealieRecipe } from "./recipe";
import type { MealieRecipe } from "./types";

/** Mealie's backup tables, keyed the way `database.json` keys them. */
const TABLES = {
  recipes: ["recipes"],
  ingredients: ["recipes_ingredients", "recipe_ingredients", "recipes_ingredient"],
  instructions: ["recipe_instructions", "recipes_instructions"],
  foods: ["ingredient_foods"],
  units: ["ingredient_units"],
  notes: ["notes", "recipe_notes"],
  tags: ["tags"],
  categories: ["categories"],
  recipesToTags: ["recipes_to_tags"],
  recipesToCategories: ["recipes_to_categories"],
} as const;

const table = (db: Node, names: readonly string[]): Node[] => {
  for (const name of names) if (Array.isArray(db[name])) return nodes(db[name]);
  return [];
};

const byId = (rows: readonly Node[]): Map<string, Node> => new Map(rows.map((row) => [text(pick(row, "id")), row]));

const position = (row: Node): number => number(pick(row, "position")) ?? 0;

/**
 * A backup's flat tables as recipe nodes of the API's shape, so one mapper
 * reads both files. A row that already carries its nested lists (Mealie writes
 * both shapes over its versions) is left as it is. Pure.
 */
export function recipesFromDatabase(db: Node): Node[] {
  const rows = table(db, TABLES.recipes);
  if (rows.length === 0) return [];
  const foods = byId(table(db, TABLES.foods));
  const unitRows = byId(table(db, TABLES.units));
  const tagRows = byId(table(db, TABLES.tags));
  const categoryRows = byId(table(db, TABLES.categories));

  const group = (all: readonly Node[]): Map<string, Node[]> => {
    const map = new Map<string, Node[]>();
    for (const row of all) {
      const key = text(pick(row, "recipe_id", "recipeId"));
      if (key === "") continue;
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    for (const list of map.values()) list.sort((a, b) => position(a) - position(b));
    return map;
  };

  const ingredients = group(table(db, TABLES.ingredients));
  const instructions = group(table(db, TABLES.instructions));
  const notes = group(table(db, TABLES.notes));
  const joined = (links: readonly Node[], lookup: Map<string, Node>, column: string): Map<string, Node[]> => {
    const map = new Map<string, Node[]>();
    for (const link of links) {
      const key = text(pick(link, "recipe_id", "recipeId"));
      const row = lookup.get(text(pick(link, column)));
      if (key === "" || row === undefined) continue;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  };
  const tagsOf = joined(table(db, TABLES.recipesToTags), tagRows, "tag_id");
  const categoriesOf = joined(table(db, TABLES.recipesToCategories), categoryRows, "category_id");

  return rows.map((row) => {
    const id = text(pick(row, "id"));
    const resolve = (ingredient: Node): Node => ({
      ...ingredient,
      food: ingredient.food ?? foods.get(text(pick(ingredient, "food_id", "foodId"))) ?? null,
      unit: ingredient.unit ?? unitRows.get(text(pick(ingredient, "unit_id", "unitId"))) ?? null,
    });
    return {
      ...row,
      recipeIngredient: Array.isArray(row.recipeIngredient) ? row.recipeIngredient : (ingredients.get(id) ?? []).map(resolve),
      recipeInstructions: Array.isArray(row.recipeInstructions) ? row.recipeInstructions : (instructions.get(id) ?? []),
      notes: Array.isArray(row.notes) ? row.notes : (notes.get(id) ?? []),
      tags: Array.isArray(row.tags) ? row.tags : (tagsOf.get(id) ?? []),
      recipeCategory: Array.isArray(row.recipeCategory) ? row.recipeCategory : (categoriesOf.get(id) ?? []),
    };
  });
}

/** Every Mealie recipe in a parsed JSON value: one recipe, a list of them, or a backup's tables. Pure. */
export function mealieRecipesFrom(value: unknown): MealieRecipe[] {
  if (Array.isArray(value)) return value.filter(looksLikeMealieRecipe).map(mealieRecipe);
  if (!isNode(value)) return [];
  if (looksLikeMealieRecipe(value)) return [mealieRecipe(value)];
  const fromTables = recipesFromDatabase(value);
  if (fromTables.length > 0) return fromTables.filter(looksLikeMealieRecipe).map(mealieRecipe);
  // A wrapper: `{ "recipes": [...] }`, `{ "data": [...] }`.
  for (const key of ["recipes", "data", "items"]) {
    const inner = value[key];
    if (inner !== undefined) {
      const found = mealieRecipesFrom(inner);
      if (found.length > 0) return found;
    }
  }
  return [];
}
