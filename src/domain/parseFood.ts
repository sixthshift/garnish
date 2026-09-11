// The food and note of an ingredient line, the third step of the parser
// decisions.md row 47 describes. Pure: no IO, importable by the client.
// Sibling of `parseQuantity.ts` and `parseUnit.ts`; M17.4 composes the three.
//
// `rest` is what `parseUnit` left after reading the leading unit ("plain
// flour, sifted", "chicken breast (about 400 g)", "salt to taste"). Unlike
// the quantity and unit steps, there is no further stage to hand a remainder
// to, so this reads the whole of `rest`:
//   - any parenthetical aside — "(about 400 g)" — is lifted out and joined
//     into the note, wherever in the line it falls.
//   - what's left is split on the first comma: the head is the food
//     candidate, the tail joins the note (after any parenthetical, in the
//     order they appeared). A second comma ("flour, sifted, cooled") stays
//     inside the note rather than splitting again.
//   - the head is matched against every food's `name`, `pluralName` and each
//     entry in `aliases`, case-insensitively, anchored at the start of the
//     head (as `parseUnit` anchors on `rest`). Longest match wins, so
//     "chicken breast" beats "chicken" when both are candidates and the head
//     has the longer word.
//
// A match is only ever a prefix of the head, never a search anywhere within
// it, so a leading word that isn't part of any candidate can never be
// silently dropped: "plain flour" against a table holding only "flour" never
// matches at all ("flour" is not a prefix of "plain flour"), so the whole
// head becomes `foodText` and `food` stays null — not "flour" with "plain"
// discarded. Anything trailing a genuine match that the head doesn't need
// (rare — most real trailing detail lands after the comma instead) is kept
// in `foodText` too, so a partial match never narrows the proposal; only a
// match spanning the entire head leaves `foodText` empty.
import type { Food } from "./recipe";

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
  const note = [...asides, tail].filter((part) => part !== "").join(", ");

  return { food, foodText, note };
}

/**
 * Lifts every parenthetical aside out of `text` (in the order they appear),
 * leaving `stripped` with each `(...)` removed. An empty or whitespace-only
 * aside — "()" — is dropped rather than joined into the note as blank text.
 */
function extractParentheticals(text: string): { stripped: string; asides: string[] } {
  const asides: string[] = [];
  const stripped = text.replace(/\(([^()]*)\)/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed !== "") asides.push(trimmed);
    return " ";
  });
  return { stripped, asides };
}

/**
 * How many characters at the start of `text` `candidate` spans, honouring a
 * word boundary at the end of the match and matching a multi-word candidate
 * across any run of whitespace. Null when `candidate` isn't a prefix.
 */
function matchLength(text: string, candidate: string): number | null {
  const words = candidate
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  const pattern = new RegExp(`^(?:${words})(?=$|[^\\p{L}\\p{N}])`, "iu");
  const match = pattern.exec(text);
  return match === null ? null : match[0].length;
}

/** Escapes regex-significant characters so a literal string can sit inside a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
