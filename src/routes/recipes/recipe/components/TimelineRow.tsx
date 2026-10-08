import { Muted } from "@sixthshift/design-system/muted";
import { toast } from "@sixthshift/design-system/overlay";
import { cn } from "@sixthshift/design-system/utils";
import { useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Menu } from "../../../../components/ui/Menu";
import { servingsLabel } from "../../../../domain/plan";
import type { TimelineEvent } from "../../../../domain/recipe";
import { formatDateStamp } from "../../../../lib/dates";
import { timelineImageUrl } from "../../../../lib/images";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { deleteTimelineEvent } from "../../../../server/fns/timeline";
import { useQuickEditContext } from "./QuickEditContext";
import { saveQuickEdit } from "./saveQuickEdit";
import { offersSaveAsNote, withNoteFromCook } from "./timelineNotes";

/** The confirm's second sentence names only what the entry holds; an entry with neither has none. */
function goesWithIt(comment: boolean, photo: boolean): string | null {
  if (comment && photo) return "Its comment and photo go with it.";
  if (comment) return "Its comment goes with it.";
  if (photo) return "Its photo goes with it.";
  return null;
}

/**
 * One compact row: the date, "serves N" beside it when the cook recorded a
 * servings count (`servingsLabel` from src/domain/plan/labels.ts — nothing
 * when it did not), the comment on the same line (truncated, a tap expanding
 * it to full text), a small square thumbnail when there is a photo, and a row
 * menu holding Delete. Delete asks first: a cook's entry, its comment and its
 * photo are history nothing brings back, so the red is the confirm's and the
 * menu item that opens it (design-language rule 5).
 */
export function TimelineRow({ event }: { event: TimelineEvent }) {
  const mutate = useMutate();
  const context = useQuickEditContext();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const photo = timelineImageUrl(event.image);
  const date = formatDateStamp(event.occurredOn);
  const hasComment = event.message.trim() !== "";
  const servings = servingsLabel(event.servings);

  const remove = async () => {
    setDeleting(true);
    try {
      await mutate(() => deleteTimelineEvent({ data: { id: event.id } }));
      toast({ intent: "success", title: "Entry deleted" });
    } catch (error) {
      toastError("Could not delete this entry", error);
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
      toast({ intent: "success", title: "Saved as a note" });
    } catch (error) {
      toastError("Could not save this as a note", error);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <li className="flex items-center gap-3 py-2" data-testid="timeline-event">
      <p className="shrink-0 font-medium text-fg-strong" data-testid="timeline-date">
        {date}
      </p>
      {servings !== "" && (
        <Muted as="span" className="shrink-0 text-xs" data-testid="timeline-servings">
          {servings}
        </Muted>
      )}
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
          <Menu.Item intent="danger" disabled={deleting} onSelect={() => setConfirming(true)}>
            Delete
          </Menu.Item>
        </Menu>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete the entry from ${date}?`}
          aria-label={`Delete the entry from ${date}`}
          confirmLabel="Delete"
          busy={deleting}
          busyLabel="Deleting…"
          onCancel={() => !deleting && setConfirming(false)}
          onConfirm={() => void remove()}
        >
          {goesWithIt(hasComment, photo !== null)}
        </ConfirmDialog>
      )}
    </li>
  );
}
