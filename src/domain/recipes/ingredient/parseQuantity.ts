/** What a line's leading amount parses to. `rest` is the line with that amount removed. */
export type ParsedQuantity = {
  quantity: number | null;
  fixed: boolean;
  rest: string;
};

/** Every glyph `format.ts`'s `VULGAR_FRACTIONS` can emit, with its value. */
const GLYPH_VALUES: ReadonlyMap<string, number> = new Map([
  ["⅒", 1 / 10],
  ["⅑", 1 / 9],
  ["⅛", 1 / 8],
  ["⅐", 1 / 7],
  ["⅙", 1 / 6],
  ["⅕", 1 / 5],
  ["¼", 1 / 4],
  ["⅓", 1 / 3],
  ["⅜", 3 / 8],
  ["⅖", 2 / 5],
  ["½", 1 / 2],
  ["⅗", 3 / 5],
  ["⅝", 5 / 8],
  ["⅔", 2 / 3],
  ["¾", 3 / 4],
  ["⅘", 4 / 5],
  ["⅚", 5 / 6],
  ["⅞", 7 / 8],
]);

/** Separators between the two halves of a range: "1-2", "1 – 2", "1 to 2". */
const RANGE = /^\s*(?:-|–|—|to\b)\s*/i;

/**
 * The leading amount of an ingredient line: `{ quantity, fixed, rest }`.
 * No leading amount leaves `quantity` null, `fixed` false and `rest` unchanged.
 */
export function parseQuantity(text: string): ParsedQuantity {
  const trimmed = text.trim();

  const fixed = trimmed.startsWith("=");
  const body = fixed ? trimmed.slice(1).trimStart() : trimmed;

  const amount = readAmount(body);
  if (amount === null) return { quantity: null, fixed: false, rest: text };

  let rest = body.slice(amount.length);

  // A range keeps its low value; the upper bound is read only to drop it.
  const separator = RANGE.exec(rest);
  if (separator !== null) {
    const upper = readAmount(rest.slice(separator[0].length));
    if (upper !== null) rest = rest.slice(separator[0].length + upper.length);
  }

  return { quantity: amount.value, fixed, rest: rest.trim() };
}

/** One amount at the front of `text`, with how many characters it spans. Null when there is none. */
function readAmount(text: string): { value: number; length: number } | null {
  const glyph = readGlyph(text, 0);
  if (glyph !== null) return glyph;

  const article = /^(?:an?)\b/i.exec(text);
  if (article !== null) return { value: 1, length: article[0].length };

  const number = /^\d+(?:\.\d+)?/.exec(text);
  if (number === null) return null;
  const value = Number(number[0]);
  const length = number[0].length;

  // "3/4": the number read was the numerator, not a whole number.
  const denominator = /^\s*\/\s*(\d+)/.exec(text.slice(length));
  if (denominator !== null) {
    const divisor = Number(denominator[1]);
    if (divisor !== 0) return { value: value / divisor, length: length + denominator[0].length };
  }

  // "1 1/2" or "1½": a whole number followed by a fraction.
  if (Number.isInteger(value)) {
    const mixed = /^\s*(\d+)\s*\/\s*(\d+)/.exec(text.slice(length));
    if (mixed !== null && Number(mixed[2]) !== 0) {
      return { value: value + Number(mixed[1]) / Number(mixed[2]), length: length + mixed[0].length };
    }
    const spacing = /^\s*/.exec(text.slice(length))?.[0].length ?? 0;
    const trailing = readGlyph(text, length + spacing);
    if (trailing !== null) return { value: value + trailing.value, length: length + spacing + trailing.length };
  }

  return { value, length };
}

/** A vulgar fraction glyph at `at`, with its span. Null when the character there is not one. */
function readGlyph(text: string, at: number): { value: number; length: number } | null {
  const character = text.slice(at, at + 1);
  const value = GLYPH_VALUES.get(character);
  return value === undefined ? null : { value, length: 1 };
}
