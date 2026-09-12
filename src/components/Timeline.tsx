// The "Made this" log on the recipe page: the button beside last-made in the
// header, and the list of logged cooks under Notes (newest first, as the
// repository returns them).
//
// Writes follow the app's one mutation pattern (src/lib/mutate.ts): call the
// server function, then invalidate, so the loader re-reads both the events and
// the recipe's refreshed `lastMade`. A photo is a second step: the event has
// to exist before the file can be stored under its id.
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import type { Recipe, TimelineEvent, TimelineEventInput } from "../domain/recipe";
import { timelineImageUrl, uploadTimelineImage } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { clearTicksNow } from "../lib/ticks";
import { setRating } from "../server/recipes";
import { createTimelineEvent, deleteTimelineEvent } from "../server/timeline";
import { formatDateStamp } from "./RecipeHeader";
import { MadeThisSheet } from "./MadeThisSheet";

export type MadeThisButtonProps = { recipe: Pick<Recipe, "id" | "name" | "rating"> };

/** What one logged cook writes: the event, an optional photo, and the rating when the sheet's stars were touched. */
export type CookSave = { recipeId: string; event: TimelineEventInput; photo: File | null; rating: number | null };

/** The three writes a logged cook makes, injected so the order is testable without a server. */
export type CookWrites = {
  createEvent: (recipeId: string, event: TimelineEventInput) => Promise<TimelineEvent>;
  uploadPhoto: (eventId: string, photo: File) => Promise<unknown>;
  rate: (recipeId: string, rating: number) => Promise<unknown>;
};

/**
 * Log a cook: create the event, upload the photo under its id if there is one,
 * and write the rating only when the stars were touched (`rating` null means
 * they were not, so an existing rating is left alone). Returns the event.
 * Pure apart from the injected writes.
 */
export async function saveCook({ recipeId, event, photo, rating }: CookSave, writes: CookWrites): Promise<TimelineEvent> {
  const created = await writes.createEvent(recipeId, event);
  if (photo) await writes.uploadPhoto(created.id, photo);
  if (rating !== null) await writes.rate(recipeId, rating);
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

/** Opens the sheet, logs the cook, uploads the photo and writes the rating, if either was given. */
export function MadeThisButton({ recipe }: MadeThisButtonProps) {
  const mutate = useMutate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (input: TimelineEventInput, photo: File | null, rating: number | null) => {
    setSaving(true);
    try {
      const event = await mutate(() =>
        saveCookAndClearTicks(
          { recipeId: recipe.id, event: input, photo, rating },
          {
            createEvent: (recipeId, created) => createTimelineEvent({ data: { recipeId, event: created } }),
            uploadPhoto: uploadTimelineImage,
            rate: (id, value) => setRating({ data: { id, rating: value } }),
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
      <MadeThisSheet
        open={open}
        busy={saving}
        rating={recipe.rating}
        onCancel={() => setOpen(false)}
        onSave={(input, photo, rating) => void save(input, photo, rating)}
      />
    </>
  );
}

export type TimelineListProps = { events: readonly TimelineEvent[]; recipe: MadeThisButtonProps["recipe"] };

/**
 * The logged cooks, newest first, under a heading that carries the button to
 * log a new one (M25.6: M24.3 dropped it from the header, and this is its
 * only home on the view page now — the finish card in cook mode keeps its own
 * copy). The heading renders even with nothing logged yet, "Not made yet"
 * standing in for the list.
 */
export function TimelineList({ events, recipe }: TimelineListProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Timeline" data-testid="timeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle as="h2">Made this</SectionTitle>
        <MadeThisButton recipe={recipe} />
      </div>
      <EmptyBoundary isEmpty={events.length === 0} fallback={<Muted as="p">Not made yet</Muted>}>
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <TimelineRow event={event} />
            </li>
          ))}
        </ul>
      </EmptyBoundary>
    </section>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const mutate = useMutate();
  const [deleting, setDeleting] = useState(false);
  const photo = timelineImageUrl(event.image);

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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-subtle p-3" data-testid="timeline-event">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-fg-strong" data-testid="timeline-date">
          {formatDateStamp(event.occurredOn)}
        </p>
        {/* A control, not content: the print stylesheet drops it. */}
        <div data-print="hide">
          <Button
            type="button"
            variant="ghost"
            intent="danger"
            size="sm"
            disabled={deleting}
            aria-label={`Delete entry from ${formatDateStamp(event.occurredOn)}`}
            onClick={() => void remove()}
          >
            Delete
          </Button>
        </div>
      </div>
      {event.message.trim() !== "" ? (
        <p className="whitespace-pre-line text-fg-normal">{event.message}</p>
      ) : (
        <Muted as="p" className="text-sm" data-empty="message">
          No comment
        </Muted>
      )}
      {photo !== null && <img src={photo} alt="" className="aspect-video w-full rounded-xl object-cover sm:max-w-sm" />}
    </div>
  );
}
