import { list, text } from "./text";

/** Words a yield uses for "servings", which say nothing once the number is held separately. */
const GENERIC_YIELD = new Set(["serving", "servings", "serves", "portion", "portions", "person", "people", "yield"]);

/**
 * Words that introduce a yield rather than describe it. BBC Good Food writes
 * "Makes 20" and plenty of sites write "Serves 4", so the number is not always
 * the first thing in the string.
 */
const YIELD_PREFIX = /^\s*(?:makes|serves|yields?|serving\s+size|about|approx(?:imately)?|around|roughly|up\s+to)\b[:\s]*/i;

/**
 * `recipeYield` as a count to scale by and what it makes. "12 muffins" is 12
 * and "muffins"; "Makes 20" is 20 and nothing; "4 servings" is 4 and nothing,
 * because the word adds nothing beside a servings field; a bare "4" is 4 and
 * nothing; "1 loaf" is 1 and "loaf". A leading "Makes"/"Serves"/"about" is
 * stripped first, repeatedly, so "Makes about 20 biscuits" reads as 20
 * biscuits. A list takes the first entry that yields a number, else the first
 * entry at all. Pure.
 */
export function parseYield(value: unknown): { servings: number; yieldText: string } {
  const entries = list(value)
    .map(text)
    .filter((entry) => entry !== "");
  const chosen = entries.find((entry) => /\d/.test(entry)) ?? entries[0] ?? "";
  let body = chosen;
  for (;;) {
    const next = body.replace(YIELD_PREFIX, "");
    if (next === body) break;
    body = next;
  }
  const match = body.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { servings: 0, yieldText: chosen.trim() };
  const rest = (match[2] ?? "").trim();
  return { servings: Number(match[1]), yieldText: GENERIC_YIELD.has(rest.toLowerCase()) ? "" : rest };
}
