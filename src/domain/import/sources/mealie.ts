// Reading a Mealie export (M34.3). Pure: bytes and JSON in, documents out, so
// the whole of it is testable without a network or a disk. The fetch of the
// uploaded file is the server route's; the writing is the review step's.
//
// Two things arrive under one "a Mealie or Tandoor export" button:
//
//   a recipe JSON   what `GET /api/recipes/{slug}` answers with, saved to a
//                   file. Also accepted as a list of them.
//   a backup zip    `database.json` (or a per-table JSON under `data/`) and
//                   the images under `data/recipes/<id>/images/`.
//
// Mealie's recipe is this app's recipe minus the part: it has one flat
// ingredient list and one flat instruction list, and a row in either can carry
// a `title`, which is Mealie's way of saying "a heading starts here". That is
// exactly a garnish part (decisions.md row 59 already reads a schema.org
// `HowToSection` the same way), so a `title` opens one: ingredient sections and
// instruction sections with the same name become the same part, and rows
// before any title belong to the unnamed main body.
//
// `food`, `unit`, `quantity` and `note` come across as they are — Mealie has
// already done the parsing, so re-parsing `originalText` would be throwing away
// a better answer than `parseIngredient` can give. `originalText` is kept
// regardless, as every other route into the review step keeps it. The rows with
// no structured food (Mealie's `isFood: false`) are the one exception: those
// are parsed, because a raw line is all there is.
//
// Tandoor's export is read by its own module (`importTandoor`, M34.4), which
// also holds the dispatcher that decides which of the two an upload is. This
// file reads Mealie and nothing else.

import { IMAGE_TYPES, sniffImage } from "../../../lib/imageFile";
import { type FoodCandidate, parseIngredient, type ReviewRow, reviewRow, type UnitCandidate } from "../../ingredient";
import { durationToMinutes, parseYield, type ScrapedPart, type ScrapedRecipe, text } from "../scraped";
import { isZip, readZip, type ZipEntry } from "./zip";

/** One of Mealie's ingredient rows, already parsed by Mealie. */
export type MealieIngredient = {
  /** The line as Mealie kept it, never lost. */
  originalText: string;
  quantity: number | null;
  /** The unit's name, or "" when the row had none. */
  unit: string;
  /** The food's name, or "" when the row was not a structured one. */
  food: string;
  note: string;
};

/**
 * A part as this import builds it: Mealie's section, owning both its
 * ingredients and its steps. `ingredients` holds the lines, which is what a
 * `ScrapedPart` is (M36.2), so a Mealie part is one; `rows` holds the same
 * rows with the structure Mealie had already parsed out of them — the food,
 * the unit, the quantity — which a line cannot carry and which the review
 * would otherwise have to guess at a second time.
 */
export type MealiePart = ScrapedPart & { rows: MealieIngredient[] };

/**
 * A Mealie recipe as this app's fields. A `ScrapedRecipe` with the structure
 * Mealie actually has — parts that own their rows, plus the notes, rating and
 * source it carries — so it lands on the same review step a scraped page does.
 */
export type MealieRecipe = Omit<ScrapedRecipe, "parts"> & {
  /** Which export this came out of, so the review and the draft can tell (M34.4). */
  source: "mealie";
  parts: MealiePart[];
  notes: { title: string; text: string }[];
  rating: number | null;
  /** Mealie's `orgURL`; "" when the recipe was typed in rather than imported. */
  sourceUrl: string;
  /** Mealie's own id, used to find the recipe's image in a backup zip. */
  sourceId: string;
};

/** The uploaded file, as the parser needs it. */
export type ImportFile = { name: string; bytes: Uint8Array };

// --- Reading values --------------------------------------------------------

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

/** The first of `names` present and not null. Mealie's backup tables are snake_case where its API is camelCase. */
function pick(node: Node, ...names: string[]): unknown {
  for (const name of names) {
    const value = node[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** A finite number, or null. A Mealie 0 means "not set" for every number this import reads. Pure. */
export function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0 ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

const nodes = (value: unknown): Node[] => (Array.isArray(value) ? value.filter(isNode) : []);

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

/** A row's line: what Mealie displayed, else what its fields spell out. Pure. */
export function ingredientLine(row: MealieIngredient): string {
  return [row.quantity === null ? "" : String(row.quantity), row.unit, row.food, row.note === "" ? "" : `, ${row.note}`]
    .filter((piece) => piece !== "")
    .join(" ")
    .replace(" ,", ",")
    .trim();
}

/** One of Mealie's `recipeIngredient` rows. Pure. */
export function mealieIngredient(node: Node): MealieIngredient {
  const food = isNode(node.food) ? text(pick(node.food, "name")) : text(pick(node, "food"));
  const unit = isNode(node.unit) ? text(pick(node.unit, "name")) : text(pick(node, "unit"));
  const row: MealieIngredient = {
    originalText: "",
    quantity: number(pick(node, "quantity")),
    unit: unit.trim(),
    food: food.trim(),
    note: text(pick(node, "note")).trim(),
  };
  const original = text(pick(node, "originalText", "original_text")).trim() || text(pick(node, "display")).trim();
  // A row Mealie never structured (its `isFood: false`) keeps its whole line in
  // `note`. The line is all there is, so it becomes the text and is not also
  // left in the note to be shown twice.
  if (row.food === "") return { ...row, originalText: original === "" ? row.note : original, note: "" };
  return { ...row, originalText: original === "" ? ingredientLine(row) : original };
}

/**
 * Mealie's two flat lists as parts. A row with a `title` opens a part of that
 * name; rows before the first title are the unnamed main body. An instruction
 * section with the same name as an ingredient section is the same part, so a
 * recipe with "Pastry" in both lists gets one Pastry part with its rows and its
 * steps. Pure.
 */
export function partsFromMealie(ingredients: readonly Node[], instructions: readonly Node[]): MealiePart[] {
  const parts: MealiePart[] = [];
  const byName = new Map<string, MealiePart>();
  const partFor = (name: string): MealiePart => {
    const key = name.toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const part: MealiePart = { name, ingredients: [], steps: [], rows: [] };
    byName.set(key, part);
    parts.push(part);
    return part;
  };

  let current = "";
  for (const row of ingredients) {
    const title = text(pick(row, "title")).trim();
    if (title !== "") current = title;
    const parsed = mealieIngredient(row);
    const part = partFor(current);
    part.rows.push(parsed);
    part.ingredients.push(parsed.originalText);
  }

  // Mealie sections its two lists separately, so untitled instructions belong
  // to the unnamed body — unless the ingredients made exactly one section and
  // the instructions name none, where the one section is plainly the recipe.
  const titled = instructions.some((step) => text(pick(step, "title")).trim() !== "");
  current = !titled && parts.length === 1 ? parts[0]!.name : "";
  for (const step of instructions) {
    const title = text(pick(step, "title")).trim();
    if (title !== "") current = title;
    const body = text(pick(step, "text")).trim();
    if (body === "") continue;
    partFor(current).steps.push(body);
  }

  return parts.length > 0 ? parts : [{ name: "", ingredients: [], steps: [], rows: [] }];
}

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

// --- A whole file ----------------------------------------------------------

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

/** JSON bytes as a value, with a message for the import screen when they are not JSON. Pure. */
export function parseJsonBytes(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("That file is not JSON or a zip");
  }
}

/** An image's bytes as a `data:` URL, or null when they are not an image this app stores. Pure. */
export function imageDataUrl(bytes: Uint8Array): string | null {
  const ext = sniffImage(bytes);
  if (ext === null) return null;
  return `data:${IMAGE_TYPES[ext]};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** The image a backup holds for a recipe id: `data/recipes/<id>/images/original.*`, else any image under that folder. Pure. */
export function imageForRecipe(entries: readonly ZipEntry[], recipeId: string): string | null {
  if (recipeId === "") return null;
  const prefix = `recipes/${recipeId.toLowerCase()}/images/`;
  const mine = entries.filter((entry) => entry.name.toLowerCase().includes(prefix));
  const best = mine.find((entry) => /\/original\.[^/]+$/i.test(entry.name)) ?? mine[0];
  return best === undefined ? null : imageDataUrl(best.bytes);
}

/**
 * The recipes in an uploaded Mealie export: a recipe JSON, or a backup zip
 * with its images attached. Throws with a message meant for the import screen.
 * No IO — the bytes are the caller's.
 */
export async function readMealieExport(file: ImportFile): Promise<MealieRecipe[]> {
  if (file.bytes.length === 0) throw new Error("That file is empty");

  if (!isZip(file.bytes)) {
    const recipes = mealieRecipesFrom(parseJsonBytes(file.bytes));
    if (recipes.length === 0) throw new Error("No Mealie recipe in that file");
    return recipes;
  }

  const entries = await readZip(file.bytes);
  const jsonEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".json"));
  // `database.json` first: a backup's other JSON files are settings and groups.
  jsonEntries.sort((a, b) => Number(b.name.toLowerCase().endsWith("database.json")) - Number(a.name.toLowerCase().endsWith("database.json")));

  const recipes: MealieRecipe[] = [];
  for (const entry of jsonEntries) {
    let found: MealieRecipe[];
    try {
      found = mealieRecipesFrom(parseJsonBytes(entry.bytes));
    } catch {
      continue; // a JSON file in the backup that is not recipes
    }
    recipes.push(...found);
  }
  if (recipes.length === 0) throw new Error("No Mealie recipes in that zip");

  return recipes.map((recipe) => ({ ...recipe, image: imageForRecipe(entries, recipe.sourceId) }));
}

// --- On to the review ------------------------------------------------------

/** A review row from a row Mealie already structured, matched against the vocabulary by name. Pure. */
export function reviewRowFromMealie<U extends UnitCandidate, F extends FoodCandidate>(
  row: MealieIngredient,
  key: string,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): ReviewRow<U, F> {
  // Nothing structured to carry across: the line is all Mealie had, so it is
  // parsed like any other pasted line.
  if (row.food === "") return reviewRow(parseIngredient(row.originalText, vocabulary), key);

  const food = matchFood(row.food, vocabulary.foods);
  const unit = row.unit === "" ? null : matchUnit(row.unit, vocabulary.units);
  return {
    key,
    originalText: row.originalText,
    quantity: row.quantity,
    fixed: false,
    note: row.note,
    unitText: unit === null ? row.unit : "",
    foodText: food === null ? row.food : "",
    unit: unit === null ? { kind: "none" } : { kind: "existing", row: unit },
    food: food === null ? { kind: "none" } : { kind: "existing", row: food },
  };
}

const same = (a: string | null | undefined, b: string): boolean => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** The food of that name, by name, plural or alias. Pure. */
export function matchFood<F extends FoodCandidate>(name: string, foods: readonly F[]): F | null {
  return foods.find((food) => same(food.name, name) || same(food.pluralName, name) || food.aliases.some((alias) => same(alias, name))) ?? null;
}

/** The unit of that name, by name, plural or abbreviation. Pure. */
export function matchUnit<U extends UnitCandidate>(name: string, units: readonly U[]): U | null {
  return units.find((unit) => same(unit.name, name) || same(unit.pluralName, name) || same(unit.abbreviation, name)) ?? null;
}

/**
 * Every row of a Mealie recipe as a review row, in part order — the same order
 * the parts' own lines are in, which is how the draft puts each row back on the
 * part it came from. Pure.
 */
export function reviewRowsFromMealie<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: MealieRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): { rows: ReviewRow<U, F>[] } {
  const rows: ReviewRow<U, F>[] = [];
  for (const part of recipe.parts) {
    for (const row of part.rows) rows.push(reviewRowFromMealie(row, String(rows.length), vocabulary));
  }
  return { rows };
}
