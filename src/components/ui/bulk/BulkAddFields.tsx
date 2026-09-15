import { Button } from "@sixthshift/design-system/button";
import { Textarea } from "@sixthshift/design-system/textarea";
import { splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../../domain/ingredient";

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
