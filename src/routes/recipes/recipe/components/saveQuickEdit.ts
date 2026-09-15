import { type RecipeDraft, validateDraft } from "../../../../domain/draft";
import { updateRecipe } from "../../../../server/fns/recipes";

/** Run a write and refresh the loaders: `useMutate`'s shape, taken as an argument so a test can stand in for it. */
export type RunWrite = <T>(write: () => Promise<T>) => Promise<T>;

/**
 * Validate a quick edit's draft and write the whole document through
 * `updateRecipe`. The same `validateDraft` the editor's Save uses, so a row
 * that cannot be stored is refused here rather than half-written; the message
 * thrown is the first field error, which is what the sheet shows.
 */
export async function saveQuickEdit(draft: RecipeDraft, run: RunWrite): Promise<void> {
  const id = draft.id;
  if (id === undefined) throw new Error("This recipe has not been saved yet");
  const result = validateDraft(draft);
  if (!result.ok) throw new Error(Object.values(result.errors)[0] ?? "This edit is not valid");
  await run(() => updateRecipe({ data: { id, doc: result.data } }));
}
