import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { ImageUpload } from "../../../../components/ui/ImageUpload";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { todayIso } from "../../../../domain/plan";
import type { TimelineEventInput } from "../../../../domain/recipe";
import { isValidDate } from "../../../../lib/dates";

export type MadeThisSheetContentProps = {
  /** Called with the event and the chosen photo. */
  onSave: (event: TimelineEventInput, photo: File | null) => void;
  onCancel: () => void;
  busy?: boolean;
  /** Injected so tests get a fixed default date. */
  today?: string;
  /** The stepper's starting value — the page's current scale. */
  defaultServings?: number;
};

export function MadeThisSheetContent({ onSave, onCancel, busy = false, today = todayIso(), defaultServings = 1 }: MadeThisSheetContentProps) {
  const [occurredOn, setOccurredOn] = useState(today);
  const [servings, setServings] = useState(defaultServings);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!isValidDate(occurredOn)) {
      setError("Pick a date.");
      return;
    }
    onSave({ occurredOn, message: message.trim(), image: null, servings }, photo);
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
          <NumberStepper label="Servings" value={servings} min={1} disabled={busy} onChange={setServings} />
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
