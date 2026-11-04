import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Label } from "@sixthshift/design-system/label";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useState } from "react";
import { Markdown } from "../../../../components/ui/Markdown";

/** A step's three prose fields: what this sheet edits and what it saves. */
export type StepPatch = { title: string; text: string; summary: string };

export type QuickEditStepBodyProps = {
  step: StepPatch;
  busy?: boolean;
  error?: string | null;
  /** Open in preview rather than editing; the toggle moves it after that, and tests use it to render that state. */
  preview?: boolean;
  onSave: (patch: StepPatch) => void;
  onCancel: () => void;
};

/**
 * One step in a sheet: its label, its text and its supporting line, with the
 * steps editor's Preview toggle beside the text, because a step is markdown and
 * the only way to see what a stray underscore did is to render it.
 *
 * The label and the supporting line are single-line inputs under and over the
 * text rather than a second textarea each: both are one short sentence by
 * construction — a label is two to four words, a supporting line is the one
 * sentence of the step that is not an instruction — and an input that cannot
 * grow is the honest way to say so.
 */
export function QuickEditStepBody({ step, busy = false, error = null, preview = false, onSave, onCancel }: QuickEditStepBodyProps) {
  const [title, setTitle] = useState(step.title);
  const [value, setValue] = useState(step.text);
  const [summary, setSummary] = useState(step.summary);
  const [previewing, setPreviewing] = useState(preview);

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Edit step</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quick-edit-step-title">Label</Label>
          <Input
            id="quick-edit-step-title"
            placeholder="Optional, e.g. Sear beef"
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="flex justify-end">
            <Toggle
              type="button"
              variant="ghost"
              intent="neutral"
              size="sm"
              aria-label="Preview step"
              pressed={previewing}
              disabled={busy}
              onPressedChange={setPreviewing}
            >
              Preview
            </Toggle>
          </div>
          {previewing ? (
            <div className="min-h-24 rounded-md border border-border-normal bg-bg-subtle px-3 py-2 text-sm" data-step-preview="">
              <Markdown source={value} />
            </div>
          ) : (
            <Textarea aria-label="Step" rows={6} placeholder="What to do" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} />
          )}
          <Label htmlFor="quick-edit-step-summary">Supporting line</Label>
          <Input
            id="quick-edit-step-summary"
            placeholder="Optional, e.g. It will look curdled at this point"
            value={summary}
            disabled={busy}
            onChange={(event) => setSummary(event.target.value)}
          />
          {error !== null && (
            <p className="text-sm text-fg-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={() => onSave({ title, text: value, summary })}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type QuickEditStepSheetProps = QuickEditStepBodyProps & { open: boolean };

export function QuickEditStepSheet({ open, ...props }: QuickEditStepSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Edit step">
      <QuickEditStepBody {...props} />
    </Sheet>
  );
}
