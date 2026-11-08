import type { Food } from "../reference";

/** The food fields matching needs. A full `Food` row satisfies it. */
export type FoodCandidate = Pick<Food, "name" | "pluralName" | "aliases">;

/**
 * What a line's food and note parse to. `foodText` is whatever of the head
 * no matched food accounts for — the whole head on a miss, empty on a full
 * match, or the leftover words in between. `note` joins any parenthetical
 * asides with the comma tail, in the order they appeared in the line.
 */
export type ParsedFood<F extends FoodCandidate> = {
  food: F | null;
  foodText: string;
  note: string;
};

/**
 * The food and note of a line: `{ food, foodText, note }`. Tries every food's
 * name, pluralName and each alias (case-insensitive) as a prefix of the
 * comma-and-parenthetical-stripped head, and keeps the longest match found.
 * No match leaves `food` null and `foodText` as the whole head.
 */
export function parseFood<F extends FoodCandidate>(rest: string, foods: readonly F[]): ParsedFood<F> {
  const { stripped, asides } = extractParentheticals(rest);

  const commaAt = stripped.indexOf(",");
  const headPart = commaAt === -1 ? stripped : stripped.slice(0, commaAt);
  const tailPart = commaAt === -1 ? "" : stripped.slice(commaAt + 1);
  const head = headPart.trim().replace(/\s+/g, " ");
  const tail = tailPart.trim();

  let best: { length: number; food: F } | null = null;
  for (const food of foods) {
    for (const candidate of [food.name, food.pluralName, ...food.aliases]) {
      if (candidate === null || candidate.trim() === "") continue;
      const length = matchLength(head, candidate);
      if (length !== null && (best === null || length > best.length)) best = { length, food };
    }
  }

  const food = best?.food ?? null;
  const foodText = best === null ? head : head.slice(best.length).trim();
  // A matched food keeps every word the line gave it (decisions.md row 221):
  // the qualifiers an alias carries ("ripe tomatoes", "lime wedges") and the
  // words after the match ("Thai basil leaves", "chilli sauce or sriracha")
  // lead the note, since the line is shown by the food's own name.
  const kept = best === null ? [] : [qualifiers(head.slice(0, best.length), best.food), foodText];
  const note = [...kept, ...asides, tail].filter((part) => part !== "").join(", ");

  return { food, foodText, note };
}

/** The words of a food's name and plural, lower-cased. */
function nameWords(food: FoodCandidate): Set<string> {
  return new Set(
    [food.name, food.pluralName ?? ""]
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word !== "")
  );
}

/**
 * The words a matched span adds to the food's own name, in the line's own
 * spelling: "ripe" from "ripe tomatoes", "wedges" from "lime wedges". Only
 * when the span holds the whole name (or plural) and more, so an alias that
 * is a synonym ("scallions", "baking soda", "Shaoxing wine") adds nothing:
 * it means the food, not a kind of it. Pure.
 */
function qualifiers(span: string, food: FoodCandidate): string {
  const words = span
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  const lower = new Set(words.map((word) => word.toLowerCase()));
  const holdsName = [food.name, food.pluralName ?? ""].some((name) => {
    const parts = name
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word !== "");
    return parts.length > 0 && parts.every((word) => lower.has(word));
  });
  if (!holdsName) return "";
  const own = nameWords(food);
  return words.filter((word) => !own.has(word.toLowerCase())).join(" ");
}

/**
 * Lifts every parenthetical aside out of `text` (in the order they appear),
 * leaving `stripped` with each `(...)` removed. An empty or whitespace-only
 * aside — "()" — is dropped rather than joined into the note as blank text.
 * Nested brackets are lifted innermost first until none are left, so a note
 * a recipe plugin wrapped in brackets the author had already typed —
 * "raw peanuts ((shelled))" — is one aside, not a food named "raw peanuts ( )".
 * A bracket that is never closed takes the rest of the line as its aside.
 */
function extractParentheticals(text: string): { stripped: string; asides: string[] } {
  const asides: string[] = [];
  let stripped = text;
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(/\(([^()]*)\)/g, (_match, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed !== "") asides.push(trimmed);
      return " ";
    });
  } while (stripped !== previous);
  const open = stripped.indexOf("(");
  if (open !== -1) {
    const rest = stripped
      .slice(open + 1)
      .replace(/[()]/g, " ")
      .trim();
    if (rest !== "") asides.push(rest);
    stripped = stripped.slice(0, open);
  }
  return { stripped: stripped.replace(/\)/g, " "), asides };
}

/**
 * How many characters at the start of `text` `candidate` spans, honouring a
 * word boundary at the end of the match and matching a multi-word candidate
 * across any run of whitespace. Null when `candidate` isn't a prefix.
 */
function matchLength(text: string, candidate: string): number | null {
  const words = candidate.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  const pattern = new RegExp(`^(?:${words})(?=$|[^\\p{L}\\p{N}])`, "iu");
  const match = pattern.exec(text);
  return match === null ? null : match[0].length;
}

/** Escapes regex-significant characters so a literal string can sit inside a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
