// Reading a Tandoor export (M34.4). Pure, like its Mealie twin: bytes and JSON
// in, documents out, so the whole of it is testable without a network or a
// disk. The upload is the route's; the writing is the review step's.
//
// Tandoor's "Default" export is a zip. One recipe is `recipe.json` beside an
// `image.*`; a whole collection is a zip of those zips, one per recipe, named
// by the recipe's id (`cookbook/integration/default.py`). A bare `recipe.json`
// is accepted too, because that is what falls out of the archive.
//
// The shape is `RecipeExportSerializer` (`cookbook/serializer.py`):
//
//   { name, description, keywords: [{name}], steps: [...], working_time,
//     waiting_time, servings, servings_text, source_url }
//
// and a step is `{ name, instruction, time, ingredients: [...], step_recipe,
// step_recipe_data }`, an ingredient `{ food: {name}, unit: {name}|null,
// amount, note, is_header, no_amount, original_text }`.
//
// Where Mealie has two flat lists and a `title` to section them, Tandoor's
// step *is* the section: it owns its ingredients and carries one instruction.
// That is this app's part almost exactly (CLAUDE.md: a recipe is an ordered
// list of named parts, each owning its ingredients and its steps), so a step
// becomes a part named by the step's `name`, the blank-named steps falling
// together into the unnamed main body the way they render in Tandoor. The
// rows come across linked to the step they were under — Tandoor already knows
// what `suggestLinks` (M28.2) has to guess, so guessing here would be throwing
// away a better answer.
//
// A step can be another recipe instead of an instruction (Tandoor's
// `step_recipe`). When that child is in the same export it becomes an
// ingredient row whose food stands for the child, ready for M32.3's
// `food.recipe_id` to be set once both are here; when it is not, the child's
// name is all there is, so the row is a plain text line naming it.

import type { FoodCandidate, ReviewRow, UnitCandidate } from "../../ingredient";
import { text } from "../scraped";
import {
  type ImportFile,
  imageDataUrl,
  ingredientLine,
  type MealieIngredient,
  type MealiePart,
  type MealieRecipe,
  number,
  parseJsonBytes,
  readMealieExport,
  reviewRowFromMealie,
  tagNames,
} from "./mealie";
import { isZip, readZip, type ZipEntry } from "./zip";

/** One of Tandoor's ingredient rows, already parsed by Tandoor. */
export type TandoorIngredient = MealieIngredient & {
  /**
   * The child recipe this row stands for (Tandoor's `step_recipe`), when that
   * recipe is in the same export. Empty on an ordinary row.
   */
  recipeName: string;
};

/**
 * A part as this import builds it: one or more of Tandoor's steps under one
 * name, owning their lines in `ingredients` (a `ScrapedPart`, M36.2) and the
 * structure Tandoor had already parsed out of them in `rows`. `stepRows` says
 * which rows belong to which step — `stepRows[i]` holds indices into `rows` —
 * so the draft can link them without `suggestLinks` having to guess.
 */
export type TandoorPart = Omit<MealiePart, "rows"> & { rows: TandoorIngredient[]; stepRows: number[][] };

/** A Tandoor recipe as this app's fields, landing on the same review a Mealie one does. */
export type TandoorRecipe = Omit<MealieRecipe, "parts" | "source"> & { source: "tandoor"; parts: TandoorPart[] };

/** Either export's recipe: what the upload route answers with and the chooser reads. */
export type FileRecipe = MealieRecipe | TandoorRecipe;

/** Which export a recipe came out of. Pure. */
export function isTandoorRecipe(recipe: FileRecipe): recipe is TandoorRecipe {
  return recipe.source === "tandoor";
}

// --- Reading values --------------------------------------------------------

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);

/** The first of `names` present and not null. */
function pick(node: Node, ...names: string[]): unknown {
  for (const name of names) {
    const value = node[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

const nodes = (value: unknown): Node[] => (Array.isArray(value) ? value.filter(isNode) : []);

// --- One recipe ------------------------------------------------------------

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

/** One Tandoor recipe node as this app's fields. Pure. */
export function tandoorRecipe(node: Node, known: ReadonlySet<string> = new Set()): TandoorRecipe {
  const parts = partsFromTandoor(nodes(pick(node, "steps")), known);
  const servings = number(pick(node, "servings")) ?? 0;
  return {
    source: "tandoor",
    name: text(pick(node, "name")).trim(),
    description: text(pick(node, "description")).trim(),
    image: null,
    servings: servings > 0 ? servings : 0,
    // Tandoor's `servings_text` is the noun beside the number ("pieces"),
    // which is this document's yield text. A bare "servings" says nothing the
    // count does not, so it is dropped.
    yieldText: yieldTextOf(text(pick(node, "servings_text", "servingsText"))),
    // Two fields for two: Tandoor's working time is time at the bench, its
    // waiting time is time it takes care of itself, which is what this
    // document's perform time holds (decisions.md row 35 adds them for a
    // total either way).
    prepMinutes: number(pick(node, "working_time", "workingTime")),
    cookMinutes: number(pick(node, "waiting_time", "waitingTime")),
    tags: tagNames(pick(node, "keywords")),
    parts,
    notes: [],
    rating: null,
    sourceUrl: text(pick(node, "source_url", "sourceUrl")).trim(),
    sourceId: text(pick(node, "id")).trim(),
  };
}

/** Tandoor's `servings_text`, minus the words that only repeat the count. Pure. */
function yieldTextOf(raw: string): string {
  const trimmed = raw.trim();
  return /^servings?$/i.test(trimmed) ? "" : trimmed;
}

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

// --- A whole file ----------------------------------------------------------

/** A folder of a Tandoor archive: its `recipe.json` and the `image.*` beside it. */
export type TandoorBundle = { json: ZipEntry; image: ZipEntry | null };

const IMAGE_NAME = /(^|\/)image\.[a-z0-9]+$/i;
const RECIPE_NAME = /(^|\/)recipe\.json$/i;

/** Where an entry lives, so a recipe and its image find each other. Pure. */
const folderOf = (name: string): string => name.slice(0, name.lastIndexOf("/") + 1);

/**
 * Every file in a Tandoor archive, the zips it holds unpacked too: a
 * collection export is a zip of one zip per recipe, and the inner name is kept
 * as a folder so each `recipe.json` still sits beside its own image.
 */
export async function readNestedZip(bytes: Uint8Array, prefix = ""): Promise<ZipEntry[]> {
  const out: ZipEntry[] = [];
  for (const entry of await readZip(bytes)) {
    const name = `${prefix}${entry.name}`;
    if (!entry.name.toLowerCase().endsWith(".zip") || !isZip(entry.bytes)) {
      out.push({ name, bytes: entry.bytes });
      continue;
    }
    out.push(...(await readNestedZip(entry.bytes, `${name}/`)));
  }
  return out;
}

/** The `recipe.json` files in an archive, each with the image in its folder. Pure. */
export function tandoorBundles(entries: readonly ZipEntry[]): TandoorBundle[] {
  const jsons = entries.filter((entry) => RECIPE_NAME.test(entry.name));
  const chosen = jsons.length > 0 ? jsons : entries.filter((entry) => entry.name.toLowerCase().endsWith(".json"));
  return chosen.map((json) => {
    const folder = folderOf(json.name);
    const beside = entries.filter((entry) => folderOf(entry.name) === folder);
    return { json, image: beside.find((entry) => IMAGE_NAME.test(entry.name)) ?? null };
  });
}

/**
 * The recipes in an uploaded Tandoor export: a `recipe.json`, the zip around
 * one, or the zip of zips a whole collection exports as, images attached.
 * Throws with a message meant for the import screen. No IO — the bytes are the
 * caller's.
 */
export async function readTandoorExport(file: ImportFile): Promise<TandoorRecipe[]> {
  if (file.bytes.length === 0) throw new Error("That file is empty");

  if (!isZip(file.bytes)) {
    const recipes = tandoorRecipesFrom(parseJsonBytes(file.bytes));
    if (recipes.length === 0) throw new Error("No Tandoor recipe in that file");
    return recipes;
  }

  const bundles = tandoorBundles(await readNestedZip(file.bytes));
  const found: { node: Node; image: ZipEntry | null }[] = [];
  for (const bundle of bundles) {
    let value: unknown;
    try {
      value = parseJsonBytes(bundle.json.bytes);
    } catch {
      continue; // a JSON file in the archive that is not a recipe
    }
    for (const node of tandoorNodes(value)) found.push({ node, image: bundle.image });
  }
  if (found.length === 0) throw new Error("No Tandoor recipes in that zip");

  const known = namesIn(found.map((entry) => entry.node));
  return found.map((entry) => ({
    ...tandoorRecipe(entry.node, known),
    image: entry.image === null ? null : imageDataUrl(entry.image.bytes),
  }));
}

// --- Either export ---------------------------------------------------------

/**
 * The recipes in an uploaded export, whichever of the two it is. Told apart by
 * shape rather than by file name: both arrive as `.zip` or `.json`, and a
 * Tandoor recipe is the one with `steps`.
 */
export async function readExport(file: ImportFile): Promise<FileRecipe[]> {
  if (file.bytes.length === 0) throw new Error("That file is empty");

  if (!isZip(file.bytes)) {
    return looksLikeTandoor(parseJsonBytes(file.bytes)) ? await readTandoorExport(file) : await readMealieExport(file);
  }

  const entries = await readNestedZip(file.bytes);
  const tandoor = entries.some((entry) => {
    if (!entry.name.toLowerCase().endsWith(".json")) return false;
    try {
      return looksLikeTandoor(parseJsonBytes(entry.bytes));
    } catch {
      return false;
    }
  });
  return tandoor ? await readTandoorExport(file) : await readMealieExport(file);
}

// --- On to the review ------------------------------------------------------

/** Where a row sits: which of its part's steps it was written under, and what it stands for. */
export type TandoorReview<U, F> = {
  rows: ReviewRow<U, F>[];
  /** The step within the row's part that owns it, or -1 when no step does. */
  rowSteps: number[];
  /** The names of the nested recipes these rows stand for, for M32.3's link. */
  subRecipeNames: string[];
};

/**
 * Every row of a Tandoor recipe as a review row, in part order — the same order
 * the parts' own lines are in, so the draft puts each row back on the part it
 * came from — with the step each row belongs to beside it, so the draft links
 * it where Tandoor had it rather than where `suggestLinks` guesses. Pure.
 */
export function reviewRowsFromTandoor<U extends UnitCandidate, F extends FoodCandidate>(
  recipe: TandoorRecipe,
  vocabulary: { units: readonly U[]; foods: readonly F[] }
): TandoorReview<U, F> {
  const rows: ReviewRow<U, F>[] = [];
  const rowSteps: number[] = [];
  const subRecipeNames: string[] = [];

  for (const part of recipe.parts) {
    const stepOf = new Map<number, number>();
    part.stepRows.forEach((indices, stepIndex) => {
      for (const index of indices) stepOf.set(index, stepIndex);
    });
    part.rows.forEach((row, index) => {
      rows.push(reviewRowFromMealie(row, String(rows.length), vocabulary));
      rowSteps.push(stepOf.get(index) ?? -1);
      if (row.recipeName !== "" && !subRecipeNames.some((name) => name.toLowerCase() === row.recipeName.toLowerCase())) {
        subRecipeNames.push(row.recipeName);
      }
    });
  }

  return { rows, rowSteps, subRecipeNames };
}
