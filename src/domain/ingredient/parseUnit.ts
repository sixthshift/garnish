// The unit of an ingredient line, the second step of the parser decisions.md
// row 47 describes. Pure: no IO, importable by the client. Sibling of
// `parseQuantity.ts`; M17.4 composes the two.
//
// `rest` is what `parseQuantity` left after reading the leading amount ("cups
// flour", "T sugar", "salt to taste"). This matches the leading token(s) of
// that string against every unit's `name`, `pluralName` and `abbreviation`,
// case-insensitively. Longest match wins, so "fluid ounce" beats "ounce" when
// both are present and the text has the longer word. A match must land on a
// word boundary — "cup" does not match "cupcakes" — and a multi-word field
// ("fluid ounce") matches across a run of whitespace, not just one space.
//
// A static alias map covers spellings the seed vocabulary (`src/db/seed/units.ts`)
// does not already carry as a name, plural or abbreviation — so "grams" is not
// in it (gram's pluralName already is), but "gr" is. `T`/`t` are the one pair
// that must stay case-sensitive even though the rest of the match is not:
// American shorthand uses the capital for tablespoon and the lowercase for
// teaspoon, and folding case would make the two indistinguishable.
//
// No match at all: null unit, the input returned unchanged so the token stays
// in `rest` for `parseFood` to try.
import type { Unit } from "../reference";

/** The unit fields matching needs. A full `Unit` row satisfies it. */
export type UnitCandidate = Pick<Unit, "name" | "pluralName" | "abbreviation">;

/** What a line's leading unit parses to. `rest` is what follows it (or the input, unchanged, on no match). */
export type ParsedUnit<U extends UnitCandidate> = {
  unit: U | null;
  rest: string;
};

/**
 * Spellings the seed vocabulary doesn't carry as a name, plural or
 * abbreviation. `T` and `t` are deliberately both present and matched
 * case-sensitively (see the file header); every other alias here is matched
 * the same way for consistency, though none of the others currently collide.
 */
const UNIT_ALIASES: ReadonlyArray<readonly [alias: string, unitName: string]> = [
  ["T", "tablespoon"],
  ["tbs", "tablespoon"],
  ["tblsp", "tablespoon"],
  ["t", "teaspoon"],
  ["gr", "gram"],
  ["mls", "millilitre"],
];

/**
 * The leading unit of a line: `{ unit, rest }`. Tries every unit's name,
 * pluralName and abbreviation (case-insensitive), then the alias map
 * (case-sensitive), and keeps the longest match found anywhere in that set.
 * No match leaves `unit` null and `rest` exactly as given.
 */
export function parseUnit<U extends UnitCandidate>(rest: string, units: readonly U[]): ParsedUnit<U> {
  const trimmed = rest.trimStart();

  let best: { length: number; unit: U } | null = null;

  for (const unit of units) {
    for (const field of [unit.name, unit.pluralName, unit.abbreviation]) {
      if (field === null || field.trim() === "") continue;
      const length = matchLength(trimmed, field, false);
      if (length !== null && (best === null || length > best.length)) best = { length, unit };
    }
  }

  for (const [alias, unitName] of UNIT_ALIASES) {
    const length = matchLength(trimmed, alias, true);
    if (length === null) continue;
    const target = units.find((unit) => unit.name.toLowerCase() === unitName);
    if (target === undefined) continue; // the alias's target isn't in this vocabulary
    if (best === null || length > best.length) best = { length, unit: target };
  }

  if (best === null) return { unit: null, rest };
  return { unit: best.unit, rest: trimmed.slice(best.length).trim() };
}

/**
 * How many characters of `text` (from the start) `candidate` spans, honouring
 * a word boundary at the end of the match and matching a multi-word
 * candidate across any run of whitespace. Null when `candidate` isn't there.
 */
function matchLength(text: string, candidate: string, caseSensitive: boolean): number | null {
  const words = candidate
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  const pattern = new RegExp(`^(?:${words})(?=$|[^\\p{L}\\p{N}])`, caseSensitive ? "u" : "iu");
  const match = pattern.exec(text);
  return match === null ? null : match[0].length;
}

/** Escapes regex-significant characters so a literal string can sit inside a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
