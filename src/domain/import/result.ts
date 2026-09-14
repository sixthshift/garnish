// What every source hands the review: one shape, whoever produced it. A page,
// a paste, a Mealie or Tandoor file and the model's read all end here, which
// is what lets one review screen serve all of them.
import type { ImportCheck } from "./check";
import type { ScrapedRecipe } from "./scraped";

/**
 * Which rung produced the result, so the review can say how much it actually
 * got. `mealie` and `tandoor` are uploaded exports (M34.3, M34.4) rather than
 * rungs of the URL import, and read as well as `schema` does: both apps have
 * already parsed the recipe. `ai` is the rung under both of the URL
 * import's (M34.5): `claude -p` reading prose that carries no structure.
 */
export type ImportSource = "schema" | "stub" | "mealie" | "tandoor" | "ai";

/** What the import found, and where it came from. */
export type ImportedRecipe = {
  from: ImportSource;
  /** The page as it was asked for, after redirects. Becomes the recipe's `sourceUrl`. */
  url: string;
  recipe: ScrapedRecipe;
  /**
   * The page's readable text (M36.3), for a future AI rung over a fetched
   * page to read alongside the rules' result. Empty for every source that
   * never held a page's HTML: the file imports, and the AI rung itself,
   * which is handed text rather than producing it.
   */
  pageText: string;
  /**
   * The anchored read's verdict (M36.5), present only when the AI rung ran
   * with a JSON-LD anchor to check against. Undefined everywhere else: the
   * rules-based rungs have nothing to check themselves against.
   */
  check?: ImportCheck;
  /**
   * The model's answer when the check rejected it. `recipe` is the anchor in
   * that case and this is what was discarded, kept so the review can show the
   * difference and offer it anyway.
   */
  rejected?: ScrapedRecipe;
};
