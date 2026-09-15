import { type DraftNote, draftFromRecipe, type RecipeDraft } from "../../../../domain/draft";
import type { Recipe, TimelineEvent } from "../../../../domain/recipe";
import { formatDateStamp } from "../../../../lib/dates";
import { randomUuid } from "../../../../lib/id";

/**
 * The stored recipe as a draft with one note appended: `{ title: "Made
 * <date>", text: event.message }`, a fresh id of its own. Every other note,
 * and every id already in the document, comes across untouched —
 * `draftFromRecipe` copies ids across and this adds nothing but the one row.
 * Pure apart from the note's id.
 */
export function withNoteFromCook(recipe: Recipe, event: TimelineEvent): RecipeDraft {
  const draft = draftFromRecipe(recipe);
  const note: DraftNote = { id: randomUuid(), title: `Made ${formatDateStamp(event.occurredOn)}`, text: event.message.trim() };
  return { ...draft, notes: [...draft.notes, note] };
}

/**
 * Whether a cook's row menu offers "Save as note": there has to be a comment
 * worth keeping, and a stored document to write it into (the recipe view's
 * `QuickEditProvider`; History renders nowhere else). Pure.
 */
export function offersSaveAsNote(event: TimelineEvent, hasContext: boolean): boolean {
  return hasContext && event.message.trim() !== "";
}
