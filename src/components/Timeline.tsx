// The "Made this" log on the recipe page: `MadeThisButton` (rendered by the
// route, beside the last step — M30.2) and `TimelineList`, the closed
// disclosure of past cooks at the foot of the page (M30.3, decisions.md row
// 64). History is read rarely, so it opens folded and each cook is one
// compact row rather than the stacked card stage 5 shipped.
//
// Writes follow the app's one mutation pattern (src/lib/mutate.ts): call the
// server function, then invalidate, so the loader re-reads both the events and
// the recipe's refreshed `lastMade`. A photo is a second step: the event has
// to exist before the file can be stored under its id.
//
// M30.4: a row's menu also gains "Save as note", shown only for a cook with a
// comment. It writes through QuickEdit's context — the same stored (unscaled)
// document and `mutate` an ingredient or step row uses — so the note is
// appended to the document the page actually persists, not the scaled view.
// `withNoteFromCook` builds the draft; `saveQuickEdit` (QuickEdit.tsx)
// validates and sends it.
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import type { Recipe, TimelineEvent, TimelineEventInput } from "../domain/recipe";
import { timelineImageUrl, uploadTimelineImage } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { clearTicksNow } from "../lib/ticks";
import { createTimelineEvent, deleteTimelineEvent } from "../server/timeline";
import { draftFromRecipe, type DraftNote, type RecipeDraft } from "./RecipeForm";
import { randomUuid } from "../lib/ids";
import { formatDateStamp } from "./RecipeHeader";
import { Disclosure } from "./ui/Disclosure";
import { Menu } from "./ui/Menu";
import { MadeThisSheet } from "./MadeThisSheet";
import { saveQuickEdit, useQuickEditContext } from "./QuickEdit";

export type MadeThisButtonProps = { recipe: Pick<Recipe, "id" | "name"> };

/** What one logged cook writes: the event and an optional photo. */
export type CookSave = { recipeId: string; event: TimelineEventInput; photo: File | null };

/** The writes a logged cook makes, injected so the order is testable without a server. */
export type CookWrites = {
  createEvent: (recipeId: string, event: TimelineEventInput) => Promise<TimelineEvent>;
  uploadPhoto: (eventId: string, photo: File) => Promise<unknown>;
};

/**
 * Log a cook: create the event, then upload the photo under its id if there
 * is one. Returns the event. Rating is not this path's job any more (M29.4):
 * it lives in the header, written straight through `setRating` from the
 * recipe route. Pure apart from the injected writes.
 */
export async function saveCook({ recipeId, event, photo }: CookSave, writes: CookWrites): Promise<TimelineEvent> {
  const created = await writes.createEvent(recipeId, event);
  if (photo) await writes.uploadPhoto(created.id, photo);
  return created;
}

/**
 * `saveCook`, then clear the recipe's ticks (M25.6): a logged cook is a fresh
 * start next time, so the ingredient and step ticks from this session are
 * wiped once the event is safely saved — not before, so a failed save leaves
 * them for another attempt.
 */
export async function saveCookAndClearTicks(save: CookSave, writes: CookWrites): Promise<TimelineEvent> {
  const created = await saveCook(save, writes);
  clearTicksNow(save.recipeId);
  return created;
}

/** Opens the sheet, logs the cook and uploads the photo, if one was given. */
export function MadeThisButton({ recipe }: MadeThisButtonProps) {
  const mutate = useMutate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (input: TimelineEventInput, photo: File | null) => {
    setSaving(true);
    try {
      const event = await mutate(() =>
        saveCookAndClearTicks(
          { recipeId: recipe.id, event: input, photo },
          {
            createEvent: (recipeId, created) => createTimelineEvent({ data: { recipeId, event: created } }),
            uploadPhoto: uploadTimelineImage,
          },
        ),
      );
      notify({ intent: "success", title: "Cook logged", message: formatDateStamp(event.occurredOn) });
      setOpen(false);
    } catch (error) {
      notifyError("Could not log this cook", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        intent="neutral"
        size="sm"
        data-testid="made-this"
        onClick={() => setOpen(true)}
      >
        Made this
      </Button>
      <MadeThisSheet open={open} busy={saving} onCancel={() => setOpen(false)} onSave={(input, photo) => void save(input, photo)} />
    </>
  );
}

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

export type TimelineListProps = { events: readonly TimelineEvent[] };

/**
 * The logged cooks, newest first, as a closed `Disclosure` titled "History"
 * with the count in its hint ("4 cooks", "1 cook") — history nobody reads
 * while cooking, so it opens folded (decisions.md row 64). Renders nothing
 * with no events: there is no "Not made yet" standing in for an empty list
 * any more, since the disclosure itself would have nothing to hold.
 */
export function TimelineList({ events }: TimelineListProps) {
  if (events.length === 0) return null;
  const hint = events.length === 1 ? "1 cook" : `${events.length} cooks`;

  return (
    <Disclosure title="History" hint={hint}>
      <ul className="flex flex-col divide-y divide-border-subtle" data-testid="timeline">
        {events.map((event) => (
          <TimelineRow key={event.id} event={event} />
        ))}
      </ul>
    </Disclosure>
  );
}

/**
 * One compact row: the date, the comment beside it on the same line
 * (truncated, a tap expanding it to full text), a small square thumbnail when
 * there is a photo, and a row menu holding Delete. No confirm — the same
 * delete path stage 5 had.
 */
function TimelineRow({ event }: { event: TimelineEvent }) {
  const mutate = useMutate();
  const context = useQuickEditContext();
  const [deleting, setDeleting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const photo = timelineImageUrl(event.image);
  const date = formatDateStamp(event.occurredOn);
  const hasComment = event.message.trim() !== "";

  const remove = async () => {
    setDeleting(true);
    try {
      await mutate(() => deleteTimelineEvent({ data: { id: event.id } }));
      notify({ intent: "success", title: "Entry deleted" });
    } catch (error) {
      notifyError("Could not delete this entry", error);
      setDeleting(false);
    }
  };

  // Appends the cook's comment to the recipe's notes through the stored
  // document (QuickEdit's context — the page's `mutate`, and the recipe as
  // the loader read it, not the scaled view). Only offered when there is a
  // comment worth keeping, and only inside a `QuickEditProvider` (the recipe
  // view route; nowhere else renders History).
  const saveAsNote = async () => {
    if (context === null) return;
    setSavingNote(true);
    try {
      await saveQuickEdit(withNoteFromCook(context.recipe, event), context.run);
      notify({ intent: "success", title: "Saved as a note" });
    } catch (error) {
      notifyError("Could not save this as a note", error);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2" data-testid="timeline-event">
      <p className="shrink-0 font-medium text-fg-strong" data-testid="timeline-date">
        {date}
      </p>
      {hasComment ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn("min-w-0 flex-1 text-left text-sm text-fg-normal", !expanded && "truncate")}
        >
          {event.message}
        </button>
      ) : (
        <Muted as="p" className="min-w-0 flex-1 truncate text-sm" data-empty="message">
          No comment
        </Muted>
      )}
      {photo !== null && <img src={photo} alt="" className="size-12 shrink-0 rounded-md object-cover" />}
      {/* A control, not content: the print stylesheet drops it. */}
      <div data-print="hide">
        <Menu label={`Actions for entry from ${date}`} iconOnly>
          {offersSaveAsNote(event, context !== null) && (
            <Menu.Item disabled={savingNote} onSelect={() => void saveAsNote()}>
              Save as note
            </Menu.Item>
          )}
          <Menu.Item intent="danger" disabled={deleting} onSelect={() => void remove()}>
            Delete
          </Menu.Item>
        </Menu>
      </div>
    </li>
  );
}
