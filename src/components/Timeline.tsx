// The "Made this" log on the recipe page: the button beside last-made in the
// header, and the list of logged cooks under Notes (newest first, as the
// repository returns them).
//
// Writes follow the app's one mutation pattern (src/lib/mutate.ts): call the
// server function, then invalidate, so the loader re-reads both the events and
// the recipe's refreshed `lastMade`. A photo is a second step: the event has
// to exist before the file can be stored under its id.
import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { useState } from "react";
import type { Recipe, TimelineEvent, TimelineEventInput } from "../domain/recipe";
import { timelineImageUrl, uploadTimelineImage } from "../lib/images";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { createTimelineEvent, deleteTimelineEvent } from "../server/timeline";
import { formatDateStamp } from "./RecipeHeader";
import { MadeThisSheet } from "./MadeThisSheet";

export type MadeThisButtonProps = { recipe: Pick<Recipe, "id" | "name"> };

/** Opens the sheet, logs the cook and uploads the photo, if there is one. */
export function MadeThisButton({ recipe }: MadeThisButtonProps) {
  const mutate = useMutate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (input: TimelineEventInput, photo: File | null) => {
    setSaving(true);
    try {
      const event = await mutate(async () => {
        const created = await createTimelineEvent({ data: { recipeId: recipe.id, event: input } });
        if (photo) await uploadTimelineImage(created.id, photo);
        return created;
      });
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

export type TimelineListProps = { events: readonly TimelineEvent[] };

/** The logged cooks, newest first. Renders nothing when there are none. */
export function TimelineList({ events }: TimelineListProps) {
  if (events.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="Timeline" data-testid="timeline">
      <SectionTitle as="h2">Made this</SectionTitle>
      <ul className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id}>
            <TimelineRow event={event} />
          </li>
        ))}
      </ul>
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
