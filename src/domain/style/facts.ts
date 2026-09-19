// The facts a restyle must keep: numbers with their units, normalised so "180C" and "180 °C" are one, and the foods the original steps mention. A unitless number inside a bracketed remark of four words or more is an aside, not a fact.

import type { OriginalPart } from "./restyleCheck";

/** Every vulgar fraction glyph a page or an editor can emit, as the ASCII fraction it stands for. */
const GLYPH_FRACTIONS: ReadonlyMap<string, string> = new Map([
  ["⅒", "1/10"],
  ["⅑", "1/9"],
  ["⅛", "1/8"],
  ["⅐", "1/7"],
  ["⅙", "1/6"],
  ["⅕", "1/5"],
  ["¼", "1/4"],
  ["⅓", "1/3"],
  ["⅜", "3/8"],
  ["⅖", "2/5"],
  ["½", "1/2"],
  ["⅗", "3/5"],
  ["⅝", "5/8"],
  ["⅔", "2/3"],
  ["¾", "3/4"],
  ["⅘", "4/5"],
  ["⅚", "5/6"],
  ["⅞", "7/8"],
]);

/**
 * The unit words that attach to a number, each mapped to the one form the fact
 * is written in. A word outside this map is prose, and its number stands alone.
 */
const UNIT_WORDS: ReadonlyMap<string, string> = new Map([
  ["minutes", "min"],
  ["minute", "min"],
  ["mins", "min"],
  ["min", "min"],
  ["hours", "h"],
  ["hour", "h"],
  ["hrs", "h"],
  ["hr", "h"],
  ["h", "h"],
  ["seconds", "s"],
  ["second", "s"],
  ["secs", "s"],
  ["sec", "s"],
  ["grams", "g"],
  ["gram", "g"],
  ["g", "g"],
  ["kilograms", "kg"],
  ["kilogram", "kg"],
  ["kilos", "kg"],
  ["kilo", "kg"],
  ["kg", "kg"],
  ["millilitres", "ml"],
  ["millilitre", "ml"],
  ["milliliters", "ml"],
  ["milliliter", "ml"],
  ["ml", "ml"],
  ["litres", "l"],
  ["litre", "l"],
  ["liters", "l"],
  ["liter", "l"],
  ["l", "l"],
  ["tablespoons", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tbsp", "tbsp"],
  ["teaspoons", "tsp"],
  ["teaspoon", "tsp"],
  ["tsp", "tsp"],
  ["cups", "cup"],
  ["cup", "cup"],
  ["celsius", "c"],
  ["c", "c"],
  ["fahrenheit", "f"],
  ["f", "f"],
  // Imperial, recognised so that "800g / 28oz" reads as one quantity written
  // twice rather than a gram fact and a bare 28: `pairedImperial` needs to see
  // the unit to know the pair.
  ["ounces", "oz"],
  ["ounce", "oz"],
  ["oz", "oz"],
  ["pounds", "lb"],
  ["pound", "lb"],
  ["lbs", "lb"],
  ["lb", "lb"],
  ["inches", "in"],
  ["inch", "in"],
  ["fl", "fl"],
]);

/** The imperial units, each with the metric ones it is written beside. */
const PAIRS: ReadonlyMap<string, readonly string[]> = new Map([
  ["f", ["c"]],
  ["oz", ["g", "kg", "ml", "l"]],
  ["lb", ["g", "kg"]],
  ["in", ["cm", "mm"]],
]);

const GLYPHS = [...GLYPH_FRACTIONS.keys()].join("");

/**
 * One fact: a number, optionally the upper half of a range, optionally a unit.
 * The number is an ASCII fraction, a decimal (with thousands separators), a
 * whole number or a glyph; the range separator is a dash or "to"; the unit is a
 * degree sign, a word, or both, and is only kept when `UNIT_WORDS` knows it.
 */
// A mixed number ("2 1/2", "2½") is one fact, so it is tried before its whole
// and fractional halves could be taken separately; a rewrite that turns
// "2 1/2 hrs" into "2½ hours" has kept the fact, not dropped one and added one.
const NUMBER = String.raw`\d+\s+\d+\s*/\s*\d+|\d+\s*[${GLYPHS}]|\d+\s*/\s*\d+|\d+(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|[${GLYPHS}]`;
const FACT = new RegExp(String.raw`(${NUMBER})(?:\s*(?:-|–|—|to)\s*(${NUMBER}))?\s*(?:°\s*)?([a-z]+\.?)?`, "giu");

/**
 * A number that is a pointer, not a fact: "(Note 4)", "see note 2", "step 5",
 * "Step 3 above". The house style's no-chatter statement removes these on
 * purpose, and the check must not then report the recipe as having lost a
 * quantity. Matched before the facts are read and blanked out of the text.
 */
const REFERENCE = /\b(?:note|notes|step|steps)\s+\d+(?:\s*(?:-|–|—|to|and|&)\s*\d+)*\b/giu;

/**
 * A step that begins with its own number — "1. For the miso marinade…", "2) Coat
 * the fish" — as an import leaves it when the source numbered its method. The
 * prompt asks for steps with no numbering of their own, so the rewrite strips
 * it, and the check must not then report the recipe as having lost a quantity.
 * The punctuation is required: "2 tbsp of the oil" opens with a real fact.
 */
const ENUMERATOR = /^\s*\d+\s*[.)]\s+/u;

/** A parenthetical with no nesting: what an author's aside looks like. */
const PARENTHETICAL = /\(([^()]*)\)/gu;

/** How many words a bracketed remark needs before it reads as a sentence rather than a quantity. */
const ASIDE_WORDS = 4;

/**
 * An aside is a parenthetical that reads as a remark — four words or more —
 * whose numbers carry no unit: "(I use 2 wooden spoons)", "(Note 5 for slow
 * cooker and pressure cooker)". The no-chatter statement drops these on
 * purpose, so their numbers are not facts. A short bracket is a quantity the
 * author tucked away — "(2 cloves)", "(about 3)", "(or 6)" — and a bracket
 * with a unit or a degree sign — "(3 - 5 minutes in total)", "(180°C)" — is
 * the method itself; both are kept. Pure.
 */
function withoutAsides(text: string): string {
  return text.replace(PARENTHETICAL, (whole, inner: string) => {
    if (inner.trim().split(/\s+/u).length < ASIDE_WORDS) return whole;
    for (const match of inner.matchAll(FACT)) {
      if (normaliseUnit(match[3]) !== null || /°/u.test(match[0])) return whole;
    }
    return " ";
  });
}

/** A number as it is written in a fact: glyphs spelled out, thousands separators and spaces gone. */
function normaliseNumber(raw: string): string {
  const glyph = GLYPH_FRACTIONS.get(raw);
  if (glyph !== undefined) return glyph;
  // A mixed number's glyph half is spelled out too, so "2½" and "2 1/2" agree.
  const mixedGlyph = /^(\d+)\s*([^\d\s])$/u.exec(raw);
  if (mixedGlyph !== null) {
    const fraction = GLYPH_FRACTIONS.get(mixedGlyph[2]!);
    if (fraction !== undefined) return `${mixedGlyph[1]} ${fraction}`;
  }
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(raw);
  if (mixed !== null) return `${mixed[1]} ${mixed[2]}/${mixed[3]}`;
  return raw.replace(/[,\s]/g, "");
}

/** The unit a word stands for, or null when the word is prose rather than a unit. */
function normaliseUnit(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  return UNIT_WORDS.get(raw.toLowerCase().replace(/\.$/, "")) ?? null;
}

/**
 * Every number token in the steps, in the order it was read (duplicates included; `factDiff` reduces them).
 * A range yields both of its ends, each carrying the unit that followed them
 * ("5-7 minutes" is "5min" and "7min"). Pure.
 */
export function factsOf(steps: readonly string[]): string[] {
  const facts: string[] = [];
  for (const step of steps) {
    const withoutReferences = withoutAsides(step.replace(ENUMERATOR, "")).replace(REFERENCE, " ");
    for (const match of withoutReferences.matchAll(FACT)) {
      const unit = normaliseUnit(match[3]) ?? "";
      facts.push(normaliseNumber(match[1]!) + unit);
      if (match[2] !== undefined) facts.push(normaliseNumber(match[2]) + unit);
    }
  }
  return facts;
}

/**
 * The imperial facts that are one half of a conversion pair: an imperial figure
 * written in the same step as a metric one it could be, as "800g / 28oz" and
 * "Heat the oven to 350°F (180°C)" both are. The metric statement drops these on
 * purpose, and the figure is not a second quantity but the first said again, so
 * the check must not report the recipe as having lost one.
 *
 * Within one string rather than across the recipe, because a recipe that gives
 * grams in one step and ounces in another is giving two quantities. Pure.
 */
export function pairedImperial(prose: readonly string[]): Set<string> {
  const paired = new Set<string>();
  for (const text of prose) {
    const units = new Set<string>();
    const found: { token: string; unit: string }[] = [];
    for (const match of withoutAsides(text.replace(ENUMERATOR, "")).replace(REFERENCE, " ").matchAll(FACT)) {
      const unit = normaliseUnit(match[3]);
      if (unit === null) continue;
      units.add(unit);
      found.push({ token: normaliseNumber(match[1]!) + unit, unit });
      if (match[2] !== undefined) found.push({ token: normaliseNumber(match[2]) + unit, unit });
    }
    for (const fact of found) {
      if (PAIRS.get(fact.unit)?.some((name) => units.has(name))) paired.add(fact.token);
    }
  }
  return paired;
}

/** Whether `name` appears in `text` as a whole word, case insensitively. Pure. */
function mentions(text: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  if (escaped === "") return false;
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped}(?![\p{L}\p{N}])`, "iu").test(text);
}

/**
 * The foods of `ingredients` that `steps` name, by the food's own name. A food
 * counts as named when either its name or its plural appears as a whole word.
 * Pure.
 */
export function foodsMentioned(steps: readonly string[], ingredients: OriginalPart["ingredients"]): string[] {
  const text = steps.join("\n");
  const found: string[] = [];
  for (const ingredient of ingredients) {
    const food = ingredient.food;
    if (!food) continue;
    if (found.includes(food.name)) continue;
    const names = [food.name, food.pluralName ?? ""].filter((name) => name.trim() !== "");
    if (names.some((name) => mentions(text, name))) found.push(food.name);
  }
  return found;
}
