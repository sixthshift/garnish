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
 * abbreviation. `T` and `t` are both present and matched case-sensitively: American
 * shorthand uses the capital for tablespoon and the lowercase for teaspoon, and folding
 * case would make them indistinguishable. Every other alias is matched the same way.
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
  const words = candidate.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  const pattern = new RegExp(`^(?:${words})(?=$|[^\\p{L}\\p{N}])`, caseSensitive ? "u" : "iu");
  const match = pattern.exec(text);
  return match === null ? null : match[0].length;
}

/** Escapes regex-significant characters so a literal string can sit inside a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
