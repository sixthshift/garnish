// The check that makes a restyle safe (M37.3). The import's check (M36.5) holds
// the model to the page's exact words; this one exists because a restyle is
// nothing but changed words, so the same comparison would reject every answer.
// What a rewrite may not change is the facts: the oven is at 180°C whichever
// way the sentence is arranged, the dough rests for 20 minutes, and the thing
// going into the pan is the chuck beef the ingredient list names. Words are the
// household's; numbers and ingredients are the recipe's.
//
// So the check is a multiset of number tokens and a set of food mentions, both
// gathered from the original steps and required to survive into the restyled
// ones. A multiset for the numbers because a step that says "2 tbsp" twice is
// saying something different from one that says it once, and one-directional
// because the interesting rewrites add numbers rather than lose them: statement
// (7) of the style guide asks for "Add 2 tbsp of the oil", which turns one
// original "3 tbsp" into a "2" and a "3". An added number is listed so the diff
// can show it, never failed.
//
// Merging and splitting steps is the point of statements (1) and (2), so the
// comparison is per part rather than per step: where a fact sits inside the
// part is the model's business, whether it is there at all is not.
//
// Normalisation is what lets "180C", "180 C" and "180°C" be one fact and
// "20 min", "20 mins" and "20 minutes" another: case folded, the space between
// number and unit closed, the degree sign and a trailing dot dropped, and the
// unit words a recipe actually uses folded to one short form each. A number
// with no unit after it, or one whose following word is not a unit ("4
// pieces"), is a fact on its own — "4" has to survive, "pieces" is a word and
// words are free. Only foods the original steps mention are required: an
// ingredient the author never named in the method cannot be dropped from it.

/** A part as this check reads it: enough of the saved `Part` and the editor's `DraftPart` to serve both. */
export type OriginalPart = {
  name: string;
  ingredients: readonly { food?: { name: string; pluralName?: string | null } | null; originalText?: string }[];
  steps: readonly { text: string }[];
};

/** A part as the restyle read answers it (M37.4): the same part, step texts only. */
export type RestyledPart = {
  name: string;
  steps: readonly string[];
};

/** What the check found for one part. `ok` is the gate; the three lists are what a diff, or a test, reads. */
export type PartRestyleCheck = {
  name: string;
  ok: boolean;
  /** Original number facts the rewrite did not carry, with duplicates repeated. */
  missingFacts: string[];
  /** Foods the original steps named that the rewrite no longer names, by the food's own name. */
  missingFoods: string[];
  /** Numbers the rewrite has beyond the original's. Reported, never failed. */
  addedNumbers: string[];
};

/** The whole recipe's verdict: the conjunction, the three lists concatenated, and the parts. */
export type RestyleCheck = {
  ok: boolean;
  missingFacts: string[];
  missingFoods: string[];
  addedNumbers: string[];
  parts: PartRestyleCheck[];
};

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
const FACT = new RegExp(
  String.raw`(${NUMBER})(?:\s*(?:-|–|—|to)\s*(${NUMBER}))?\s*(?:°\s*)?([a-z]+\.?)?`,
  "giu",
);

/**
 * A number that is a pointer, not a fact: "(Note 4)", "see note 2", "step 5",
 * "Step 3 above". The house style's no-chatter statement removes these on
 * purpose, and the check must not then report the recipe as having lost a
 * quantity. Matched before the facts are read and blanked out of the text.
 */
const REFERENCE = /\b(?:note|notes|step|steps)\s+\d+(?:\s*(?:-|–|—|to|and|&)\s*\d+)*\b/giu;

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
 * Every number token in the steps, as a multiset in the order it was read.
 * A range yields both of its ends, each carrying the unit that followed them
 * ("5-7 minutes" is "5min" and "7min"). Pure.
 */
export function factsOf(steps: readonly string[]): string[] {
  const facts: string[] = [];
  for (const step of steps) {
    const withoutReferences = step.replace(REFERENCE, " ");
    for (const match of withoutReferences.matchAll(FACT)) {
      const unit = normaliseUnit(match[3]) ?? "";
      facts.push(normaliseNumber(match[1]!) + unit);
      if (match[2] !== undefined) facts.push(normaliseNumber(match[2]) + unit);
    }
  }
  return facts;
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
export function foodsMentioned(
  steps: readonly string[],
  ingredients: OriginalPart["ingredients"],
): string[] {
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

/** The original facts the rewrite did not carry, and the numbers it has beyond them. Both multisets. */
function factDiff(original: readonly string[], restyled: readonly string[]): { missing: string[]; added: string[] } {
  const counts = new Map<string, number>();
  for (const fact of original) counts.set(fact, (counts.get(fact) ?? 0) + 1);

  const added: string[] = [];
  for (const fact of restyled) {
    const remaining = counts.get(fact) ?? 0;
    if (remaining > 0) counts.set(fact, remaining - 1);
    else added.push(fact);
  }

  const missing: string[] = [];
  for (const fact of original) {
    const remaining = counts.get(fact) ?? 0;
    if (remaining > 0) {
      missing.push(fact);
      counts.set(fact, remaining - 1);
    }
  }
  return { missing, added };
}

/** One part's verdict: its numbers survived and the foods it named are still named. Pure. */
export function checkPart(original: OriginalPart, restyled: RestyledPart): PartRestyleCheck {
  const originalSteps = original.steps.map((step) => step.text);
  const restyledSteps = [...restyled.steps];

  const { missing, added } = factDiff(factsOf(originalSteps), factsOf(restyledSteps));
  const required = foodsMentioned(originalSteps, original.ingredients);
  const kept = foodsMentioned(restyledSteps, original.ingredients);
  const missingFoods = required.filter((name) => !kept.includes(name));

  return {
    name: original.name,
    ok: missing.length === 0 && missingFoods.length === 0,
    missingFacts: missing,
    missingFoods,
    addedNumbers: added,
  };
}

/**
 * The whole restyle's verdict, part by part. Parts pair by index, which M37.4
 * guarantees by rejecting any answer with a different count or different names
 * as `malformed`; a mismatch reaching here is a bug rather than a failed check,
 * so it throws instead of returning `ok: false`. Pure.
 */
export function checkRestyle(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): RestyleCheck {
  if (original.length !== restyled.length) {
    throw new Error(`restyle check: ${original.length} original parts against ${restyled.length} restyled`);
  }
  const parts = original.map((part, index) => checkPart(part, restyled[index]!));
  return {
    ok: parts.every((part) => part.ok),
    missingFacts: parts.flatMap((part) => part.missingFacts),
    missingFoods: parts.flatMap((part) => part.missingFoods),
    addedNumbers: parts.flatMap((part) => part.addedNumbers),
    parts,
  };
}
