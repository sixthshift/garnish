// Quantities, units, foods and tags as the editor reads and writes them.
import { type FoodRow, type Food, type Unit, type Tag } from "../reference";
import { randomUuid } from "../../lib/id";
import { slugify } from "../names";

export const VULGAR: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
};

/**
 * A quantity field's text as a number, or null for "no amount". Accepts
 * decimals ("0.5", "2"), fractions ("1/2"), mixed numbers ("1 1/2", "1½") and
 * the vulgar fraction glyphs the recipe page prints ("½"). Blank, unparseable
 * text and division by zero are null; the sign is kept so zod can reject a
 * negative. Pure.
 */
export function parseQuantity(text: string): number | null {
  let s = text.trim().replace(/\s+/g, " ");
  if (s === "") return null;
  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1).trim();
  }
  // Trailing glyph: "1½" or "½".
  const last = s.slice(-1);
  if (last in VULGAR) {
    const whole = s.slice(0, -1).trim();
    if (whole === "") return sign * VULGAR[last]!;
    if (!/^\d+$/.test(whole)) return null;
    return sign * (Number(whole) + VULGAR[last]!);
  }
  const mixed = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, numerator, denominator] = mixed;
    if (Number(denominator) === 0) return null;
    return sign * ((whole ? Number(whole) : 0) + Number(numerator) / Number(denominator));
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return sign * Number(s);
}

/** The text a quantity shows when not being edited: "" for null, else the plain number. Pure. */
export function quantityText(quantity: number | null | undefined): string {
  return quantity === null || quantity === undefined ? "" : String(quantity);
}

/**
 * A food reference for the document from a `listFoods` row (its aisle is sent
 * as null; the repository keeps the stored row untouched) or, given only a
 * name, a new reference with a client id the repository will replace. Pure
 * apart from the random id.
 */
export function foodReference(source: FoodRow | { name: string }): Food {
  if ("id" in source) {
    return {
      id: source.id,
      name: source.name,
      pluralName: source.pluralName,
      aliases: source.aliases,
      aisle: null,
      recipeId: source.recipeId,
      skipShopping: source.skipShopping,
      conversions: [],
    };
  }
  return { id: randomUuid(), name: source.name.trim(), pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false, conversions: [] };
}

/** A new unit reference by name, defaults for the rest; the repository find-or-creates it on save. Pure apart from the random id. */
export function unitReference(name: string): Unit {
  return { id: randomUuid(), name: name.trim(), pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null };
}

/** The unit whose name, plural or abbreviation equals `text`, ignoring case. Pure. */
export function matchUnit(units: readonly Unit[], text: string): Unit | undefined {
  const key = text.trim().toLowerCase();
  if (key === "") return undefined;
  return (
    units.find((unit) => unit.name.toLowerCase() === key) ??
    units.find((unit) => unit.abbreviation.trim().toLowerCase() === key) ??
    units.find((unit) => (unit.pluralName ?? "").trim().toLowerCase() === key)
  );
}

/** Units whose name, plural or abbreviation contains `text` (case-insensitive); all of them for blank text. Pure. */
export function filterUnits(units: readonly Unit[], text: string): Unit[] {
  const key = text.trim().toLowerCase();
  if (key === "") return units.slice();
  return units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(key) ||
      unit.abbreviation.toLowerCase().includes(key) ||
      (unit.pluralName ?? "").toLowerCase().includes(key),
  );
}

/**
 * Tag references for the names in the tag input: an existing tag by name
 * (case-insensitive, from `known`), else a new reference the server will
 * find-or-create by name. Blank and duplicate names are dropped. Pure apart
 * from the random id on a new tag.
 */
export function tagsFromNames(names: readonly string[], known: readonly Tag[]): Tag[] {
  const out: Tag[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(known.find((tag) => tag.name.toLowerCase() === key) ?? { id: randomUuid(), name, slug: slugify(name) || name });
  }
  return out;
}
