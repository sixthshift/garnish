import type { ScrapedPart } from "./types";

/**
 * A parenthesised pointer at the page's notes — "(Note 4)", "(see notes)" —
 * which sites hang off a heading because the heading is the only place the
 * reader is looking. It belongs to the page, not to the part.
 */
const NOTE_MARKER = /\(\s*(?:see\s+)?notes?\b[^)]*\)/gi;

/**
 * A heading as a part name. Headings are written for a page, not for
 * this document: they carry the colon that introduces the list below them, the
 * note marker that points at the page's footnotes, and often the shouting caps
 * of a template's h3. None of that is part of the name — "SAUCE:" and "Sauce"
 * are the same part — and the tidying happens here rather than in each rung so
 * a name reads the same whether it came off a `HowToSection`, a model's answer
 * or a paste.
 *
 * All-caps is softened to sentence case rather than title case: the app has no
 * way to know which words a title would capitalise, and "Abbreviated recipe"
 * is right where "Abbreviated Recipe" is a guess. Mixed-case names are left
 * exactly as the page wrote them. Pure.
 */
export function tidyPartName(name: string): string {
  const withoutNotes = name.replace(NOTE_MARKER, " ").replace(/\s+/g, " ").trim();
  const withoutColon = withoutNotes.replace(/\s*:+\s*$/, "").trim();
  const letters = withoutColon.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2 || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return withoutColon;
  const lowered = withoutColon.toLowerCase();
  return lowered.replace(/\p{L}/u, (first) => first.toUpperCase());
}

/**
 * Parts with their names tidied and any that tidy to the same name folded
 * together, keeping the order the first of them appeared in. Two headings that
 * only differed in a colon are one part, and a recipe never ends up with the
 * same part name twice. Pure.
 */
export function tidyParts(parts: readonly ScrapedPart[]): ScrapedPart[] {
  const byName = new Map<string, ScrapedPart>();
  const out: ScrapedPart[] = [];
  for (const part of parts) {
    const name = tidyPartName(part.name);
    const existing = byName.get(name);
    if (existing === undefined) {
      const fresh = { name, ingredients: [...part.ingredients], steps: [...part.steps] };
      byName.set(name, fresh);
      out.push(fresh);
      continue;
    }
    existing.ingredients.push(...part.ingredients);
    existing.steps.push(...part.steps);
  }
  return out;
}

/** Every ingredient line across the parts, in part order: what the review reads and what `reviewRows` parses. Pure. */
export function ingredientLines(scraped: { parts: readonly ScrapedPart[] }): string[] {
  return scraped.parts.flatMap((part) => part.ingredients);
}
