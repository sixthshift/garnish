import { type ImportFile, imageDataUrl, parseJsonBytes } from "../file";
import type { Node } from "../json";
import { isZip, readZip, type ZipEntry } from "../zip";
import { namesIn, tandoorNodes, tandoorRecipesFrom } from "./detect";
import { tandoorRecipe } from "./recipe";
import type { TandoorRecipe } from "./types";

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
