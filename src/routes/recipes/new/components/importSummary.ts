import { type ImportCheck, type ImportedRecipe, type ImportSource, review, type ScrapedRecipe } from "../../../../domain/import";
import { messageFrom } from "../../../../lib/notify";

/** Which source the chooser is on. `paste` is the AI rung and only appears when `claude` is installed. */
export type SourceKind = "url" | "manual" | "file" | "paste";

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

export function yieldLabel(scraped: ScrapedRecipe): string {
  if (scraped.servings > 0 && scraped.yieldText !== "") return `${scraped.servings} ${scraped.yieldText}`;
  if (scraped.servings > 0) return `Serves ${scraped.servings}`;
  return scraped.yieldText;
}

/** How many ingredient lines came back across every part. Pure. */
export function ingredientCount(scraped: ScrapedRecipe): number {
  return review.ingredientLines(scraped).length;
}

/** How many steps came back across every part. Pure. */
export function stepCount(scraped: ScrapedRecipe): number {
  return scraped.parts.reduce((total, part) => total + part.steps.length, 0);
}

/**
 * What the review says it got, and how. `sorted` is the model's part in it
 *: true when the parts on the screen are the model's reading of the
 * page's headings, false when a `schema` page arrived with no model to sort
 * it, and null when the question does not arise — a paste, an upload, a read
 * still running. Pure.
 */
export function importSummary(from: ImportSource, ingredients: number, steps: number, sorted: boolean | null = null): string {
  if (from === "stub") return "That page has no recipe data, so this is just its title and picture. The rest is yours to type in.";
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const read = `Read ${count(ingredients, "ingredient")} and ${count(steps, "step")}.`;
  const nothingSaved = "Nothing is saved yet, and no food or unit is created unless you ask for it below.";
  // An anchored read changed nothing but the shape: the lines are the page's
  // own, checked against it word for word, and the parts are what the model
  // added. Saying so tells the household what is worth checking.
  if (sorted === true) {
    return `The page's ${count(ingredients, "ingredient")} and ${count(steps, "step")} sorted into parts by the model. The words are the page's own — check the parts. ${nothingSaved}`;
  }
  // An AI read is a reading, not a transcription, so the review is told to
  // check it rather than merely approve it.
  if (from === "ai")
    return `Claude ${read.toLowerCase()} Check them against what you pasted — nothing is saved yet, and no food or unit is created unless you ask for it below.`;
  // No model to read the page, so the headings it had are gone: schema.org
  // cannot say which part a line belongs to, and nothing else was asked.
  if (sorted === false)
    return `${read} No model is configured, so the page's sections were not sorted into parts and every line is on the main body. ${nothingSaved}`;
  return `${read} ${nothingSaved}`;
}

/**
 * What the model's version did to the page's, as the review says it: "dropped
 * 1 line and reworded 2 steps". A line missing on one side and one added on
 * the other is one rewording rather than two changes, because that is what it
 * is and counting it twice would overstate the damage. Pure.
 */
export function changeSummary(check: ImportCheck): string {
  const clauses: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  for (const [missing, added, noun] of [
    [check.missingLines, check.addedLines, "line"],
    [check.missingSteps, check.addedSteps, "step"],
  ] as const) {
    const reworded = Math.min(missing.length, added.length);
    if (missing.length - reworded > 0) clauses.push(`dropped ${count(missing.length - reworded, noun)}`);
    if (added.length - reworded > 0) clauses.push(`added ${count(added.length - reworded, noun)}`);
    if (reworded > 0) clauses.push(`reworded ${count(reworded, noun)}`);
  }
  if (clauses.length === 0) return "changed nothing";
  if (clauses.length === 1) return clauses[0]!;
  return `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}

/** The rejection notice in one sentence. Pure. */
export function rejectionMessage(check: ImportCheck): string {
  return `The model's version ${changeSummary(check)}, so the page's version is shown.`;
}

/** Every line the check objected to, labelled for the list under the notice. Pure. */
export function changedLines(check: ImportCheck): { label: string; text: string }[] {
  return [
    ...check.missingLines.map((text) => ({ label: "Dropped", text })),
    ...check.addedLines.map((text) => ({ label: "Added", text })),
    ...check.missingSteps.map((text) => ({ label: "Dropped step", text })),
    ...check.addedSteps.map((text) => ({ label: "Added step", text })),
  ];
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
  if (imported.from !== "schema" && imported.from !== "stub") return false;
  return imported.pageText.trim() !== "";
}

/**
 * The rejected answer put in the accepted one's place ("Use the
 * model's version anyway"). `check` stays so the summary still says the parts
 * are the model's; `rejected` goes, because it is now what is on the screen.
 */
export function withRejectedAnswer(imported: ImportedRecipe): ImportedRecipe {
  if (imported.rejected === undefined) return imported;
  return { from: "ai", url: imported.url, recipe: imported.rejected, pageText: imported.pageText, check: imported.check };
}

/** The review's duplicate warning: the same recipe by address or by name. Pure. */
export function duplicateMessage(name: string, by: DuplicateBy): string {
  return by === "name"
    ? `“${name}” is already here under that name. Creating this makes a second copy.`
    : `“${name}” was imported from the same address. Creating this makes a second copy.`;
}

/** How the review found the duplicate it is warning about. */
export type DuplicateBy = "url" | "name";
