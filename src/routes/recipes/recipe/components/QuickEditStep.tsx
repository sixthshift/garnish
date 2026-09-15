import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useState } from "react";
import { Markdown } from "../../../../components/ui/Markdown";

export type QuickEditStepBodyProps = {
  text: string;
  busy?: boolean;
  error?: string | null;
  /** Open in preview rather than editing; the toggle moves it after that, and tests use it to render that state. */
  preview?: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
};

/**
 * One step's text in a sheet: a `Textarea`, and the steps editor's Preview
 * toggle beside it, because a step is markdown and the only way to see what a
 * stray underscore did is to render it.
 */
export function QuickEditStepBody({ text, busy = false, error = null, preview = false, onSave, onCancel }: QuickEditStepBodyProps) {
  const [value, setValue] = useState(text);
  const [previewing, setPreviewing] = useState(preview);

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Edit step</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-2">
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
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={() => onSave(value)}>
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
