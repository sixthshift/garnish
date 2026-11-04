// The tags an import offers, as the review shows them (decisions.md row 171).
// A recipe site's keywords are written for search engines, not for a
// household's shelves: most restate the recipe's name ("Tuscan chicken
// recipe" on Creamy Tuscan Chicken), so taking them as tags made one new tag
// per import. Mealie leaves "import original keywords as tags" off; here they
// are offered instead. A tag the household already has comes ticked, a new one
// unticked, and a phrase that only repeats the name, or reads as a search
// phrase, is left out and listed as such. An export from Mealie or Tandoor
// carries the household's own tags from that app, so all of those come ticked.
import { type Tag, tagKey, tagNamesFrom } from "../reference";

export type TagSuggestion = {
  /** The tag's name: the household's own spelling when it already has the tag. */
  name: string;
  /** Whether the household already has this tag. */
  known: boolean;
  /** Whether the review starts with it ticked. */
  ticked: boolean;
};

export type TagSuggestions = {
  suggested: TagSuggestion[];
  /** The source's tags left out, by name, so the review can say what it did not offer. */
  leftOut: string[];
};

/** Longer than this, a keyword is a search phrase rather than a shelf. */
const MAX_WORDS = 4;
const MAX_LENGTH = 30;

/** Lower-case words with accents stripped: "Sautéed" and "sauteed" are one word. Pure. */
function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("en-AU")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

/** Whether `name` is left out rather than offered. Pure. */
function leaveOut(name: string, recipeWords: ReadonlySet<string>): boolean {
  const own = words(name);
  if (own.includes("recipe") || own.includes("recipes")) return true;
  if (own.length > MAX_WORDS || name.length > MAX_LENGTH) return true;
  // A phrase of two words or more, every one of them in the recipe's name,
  // says nothing the name does not. One word is a category ("Chinese" on a
  // Chinese stir-fry) and stays.
  return own.length >= 2 && own.every((word) => recipeWords.has(word));
}

/**
 * The review's tags for `names` (a source's tags, in its order) on a recipe
 * called `recipeName`. `own` is true for an export of the household's own
 * tags (Mealie, Tandoor): every one is offered ticked. Otherwise a tag already
 * in `known` is offered ticked under the household's spelling — even one that
 * repeats the name, since the household chose it — a new one unticked, and the
 * rest are left out. Pure.
 */
export function tagSuggestions(names: readonly string[], recipeName: string, known: readonly Tag[], own = false): TagSuggestions {
  const recipeWords = new Set(words(recipeName));
  const suggested: TagSuggestion[] = [];
  const leftOut: string[] = [];
  for (const name of tagNamesFrom(names)) {
    const key = tagKey(name);
    const existing = known.find((tag) => tagKey(tag.name) === key);
    if (existing !== undefined) suggested.push({ name: existing.name, known: true, ticked: true });
    else if (own) suggested.push({ name, known: false, ticked: true });
    else if (leaveOut(name, recipeWords)) leftOut.push(name);
    else suggested.push({ name, known: false, ticked: false });
  }
  return { suggested, leftOut };
}

/** The names a review starts with ticked. Pure. */
export function tickedTags(suggestions: TagSuggestions): string[] {
  return suggestions.suggested.filter((tag) => tag.ticked).map((tag) => tag.name);
}
