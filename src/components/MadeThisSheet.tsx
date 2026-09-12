// "Made this": the sheet behind the button beside last-made in the header.
// A logged cook is a date (today by default), an optional comment and an
// optional photo — Mealie's timeline entry, minus the entry types it only
// writes from imports.
//
// The photo is uploaded after the event exists, because the file is stored
// under the event's id; the caller does that in `onSave` and only needs to
// hand back a promise it can await.
//
// The moment a cook is logged is the moment to rate it, as Tandoor's cook log
// does, so the stars sit above the comment (M25.3). They start on the recipe's
// current rating and are only written when they were actually touched:
// `onSave`'s third argument is null for a save that leaves them alone, so
// logging a cook never quietly re-writes an existing rating.
//
// Sheet only paints after mounting on the client, so the form lives in
// `MadeThisSheetContent`, which renders anywhere and is what the tests
// exercise.
import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import type { TimelineEventInput } from "../domain/recipe";
import { ImageUpload } from "./ui/ImageUpload";
import { Rating } from "./ui/Rating";

/** Today as the calendar date the form and `occurred_on` use (YYYY-MM-DD), in local time. Pure. */
export function todayIso(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True for a date the form will accept: a real calendar date in YYYY-MM-DD. Pure. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/** The rating a save carries: the stars when they were touched, null when they were left alone. Pure. */
export function ratingForSave(touched: boolean, rating: number): number | null {
  return touched ? rating : null;
}

export type MadeThisSheetContentProps = {
  /** Called with the event, the chosen photo, and the rating when the stars were touched (null otherwise). */
  onSave: (event: TimelineEventInput, photo: File | null, rating: number | null) => void;
  onCancel: () => void;
  busy?: boolean;
  /** Injected so tests get a fixed default date. */
  today?: string;
  /** The recipe's rating now; the stars start here and only travel when touched. */
  rating?: number | null;
};

export function MadeThisSheetContent({
  onSave,
  onCancel,
  busy = false,
  today = todayIso(),
  rating = null,
}: MadeThisSheetContentProps) {
  const [occurredOn, setOccurredOn] = useState(today);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(rating ?? 0);
  const [touched, setTouched] = useState(false);

  const submit = () => {
    if (!isValidDate(occurredOn)) {
      setError("Pick a date.");
      return;
    }
    onSave({ occurredOn, message: message.trim(), image: null }, photo, ratingForSave(touched, stars));
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Made this</h2>
      </Sheet.Header>
      <Sheet.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField label="Date" required feedback={error ? { message: error, intent: "danger" } : undefined}>
            <Input type="date" value={occurredOn} disabled={busy} aria-label="Date" onChange={(event) => setOccurredOn(event.target.value)} />
          </FormField>
          <FormField label="Rating" description="How was it?">
            <Rating
              value={stars}
              disabled={busy}
              onChange={(next) => {
                setStars(next);
                setTouched(true);
              }}
            />
          </FormField>
          <FormField label="Comment" description="How did it go?">
            <Textarea value={message} disabled={busy} aria-label="Comment" onChange={(event) => setMessage(event.target.value)} />
          </FormField>
          <FormField label="Photo">
            <ImageUpload disabled={busy} onSelect={setPhoto} onRemove={() => setPhoto(null)} />
          </FormField>
        </form>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type MadeThisSheetProps = MadeThisSheetContentProps & { open: boolean };

export function MadeThisSheet({ open, ...props }: MadeThisSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Made this">
      <MadeThisSheetContent {...props} />
    </Sheet>
  );
}
