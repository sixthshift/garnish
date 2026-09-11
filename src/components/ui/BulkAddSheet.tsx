// A `sheet` for pasting a batch of items, one per line, used by the
// ingredients and steps editors (M13.4). Three buttons clean up a rough paste
// before "Add" commits it: trim each line, strip a leading list number
// ("1.", "2)"), or turn blank-line-separated paragraphs into one line each.
// "Add" splits the cleaned text on newlines, drops blank lines, and hands the
// caller one string per remaining line — the ingredients editor turns each
// into a text-only row, the steps editor into a step of its own.
//
// `BulkAddFields` (the textarea and the three buttons) is a plain function of
// `text` and `onTextChange`, no state of its own, so a test can call it
// directly and drive its buttons without a DOM — the same shape as
// `IngredientFields`. `BulkAddSheet` only adds the sheet chrome and the
// open/text state around it.
import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { bulkLines, splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../domain/bulkText";

export type BulkAddFieldsProps = {
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  text: string;
  disabled?: boolean;
  onTextChange: (text: string) => void;
};

export function BulkAddFields({ itemName, text, disabled, onTextChange }: BulkAddFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-subtle">{`One ${itemName} per line.`}</p>
      <Textarea
        aria-label={`Bulk ${itemName} text`}
        rows={10}
        placeholder={`Paste ${itemName}s, one per line`}
        value={text}
        disabled={disabled}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(trimLines(text))}>
          Trim whitespace
        </Button>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(stripLeadingNumbers(text))}>
          Strip leading numbers
        </Button>
        <Button type="button" variant="outline" intent="neutral" size="sm" disabled={disabled} onClick={() => onTextChange(splitOnBlankLines(text))}>
          Split on blank lines
        </Button>
      </div>
    </div>
  );
}

export type BulkAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Noun for labels and copy: "ingredient" or "step". */
  itemName: string;
  /** Called once, with one string per non-blank line, when "Add" is pressed. Not called when the sheet is cancelled or the text is blank. */
  onAdd: (lines: string[]) => void;
  disabled?: boolean;
};

export function BulkAddSheet({ open, onOpenChange, itemName, onAdd, disabled }: BulkAddSheetProps) {
  const [text, setText] = useState("");

  const close = () => {
    setText("");
    onOpenChange(false);
  };

  const add = () => {
    const lines = bulkLines(text);
    if (lines.length > 0) onAdd(lines);
    close();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      size="md"
      closable
      aria-label={`Bulk add ${itemName}s`}
    >
      <Sheet.Header>
        <h2 className="text-base font-medium">{`Bulk add ${itemName}s`}</h2>
      </Sheet.Header>
      <Sheet.Body>
        <BulkAddFields itemName={itemName} text={text} disabled={disabled} onTextChange={setText} />
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={disabled} onClick={close}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={disabled || bulkLines(text).length === 0} onClick={add}>
          Add
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
}
