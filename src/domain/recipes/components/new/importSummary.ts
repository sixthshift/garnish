import { messageFrom } from "../../../../lib/errors";
import type { ImportedRecipe, ScrapedRecipe } from "../../import";

/** Which source the chooser is on. `paste` is the AI rung and only appears when `claude` is installed. */
export type SourceKind = "url" | "manual" | "file" | "paste" | "browser" | "page";

/** The AI read as the review needs it: the page's text, and the rules result as the anchor when it had one. */
export type ModelReader = (text: string, anchor?: ScrapedRecipe) => Promise<ImportedRecipe>;

/**
 * The model's pass over a rules result. The address and the page's text are
 * carried over from the rules result rather than taken from the answer, so a
 * retry, or the swap to a rejected answer, still has everything the first read
 * had. A failure is returned rather than thrown: the rules result stays on the
 * screen and the message goes beside it.
 */
export async function modelPass(imported: ImportedRecipe, read: ModelReader): Promise<{ ok: true; result: ImportedRecipe } | { ok: false; error: string }> {
  try {
    const anchor = imported.from === "schema" ? imported.recipe : undefined;
    const result = await read(imported.pageText, anchor);
    return { ok: true, result: { ...result, url: imported.url, pageText: imported.pageText } };
  } catch (cause) {
    return { ok: false, error: messageFrom(cause) };
  }
}

/** What Check says over pasted text there was no model to read. */
export const PASTE_NOTE = "Your pasted text is in the ingredient box. Keep the ingredient lines there, and move the method into Steps.";

/** What Check says when the page had no recipe on it, only a title and a picture. */
export const STUB_NOTE = "That page has no recipe data, so this is just its title and picture. The rest is yours to type in.";

/** The one line Check shows when the model's sort did not land (decisions.md row 203). */
export const SORT_NOTE = "Couldn't sort this into parts. You can add parts yourself.";

/**
 * The read as Check opens on it: the model's sort when it answered and the
 * check kept it, otherwise the rules' own reading with the quiet note. A
 * rejected answer is not offered: everything the sort could have done can be
 * done by hand on Check.
 */
export async function sortedRead(found: ImportedRecipe, read: ModelReader): Promise<{ imported: ImportedRecipe; note: string | null }> {
  const outcome = await modelPass(found, read);
  if (!outcome.ok || outcome.result.rejected !== undefined) return { imported: found, note: SORT_NOTE };
  return { imported: outcome.result, note: null };
}

/**
 * Whether this result is worth handing to the model on arrival. Only
 * a page: an upload already states its parts and a paste has already been
 * read. A `schema` result goes anchored and a `stub` result goes bare, and
 * neither goes anywhere without the page's text to read.
 *
 * A result that already carries a `check` has been past the model on the
 * server (pasted HTML, which runs the whole pipeline there), so it is
 * shown as it stands. Reading it again would only ask the same model the same
 * question twice.
 */
export function shouldReadWithModel(imported: ImportedRecipe, aiAvailable: boolean): boolean {
  if (!aiAvailable) return false;
  if (imported.check !== undefined) return false;
  // The page's own recipe card already placed every line and step (decisions.md row 204).
  if (imported.partsFromPage === "complete") return false;
  if (imported.from !== "schema" && imported.from !== "stub") return false;
  return imported.pageText.trim() !== "";
}

/** How the review found the duplicate it is warning about. */
export type DuplicateBy = "url" | "name";
