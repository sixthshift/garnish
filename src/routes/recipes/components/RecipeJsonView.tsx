import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";

export type RecipeJsonViewProps = {
  json: string;
  /** Why the last Apply failed, or null. */
  error: string | null;
  disabled?: boolean;
  onChange: (json: string) => void;
  onApply: () => void;
};

/** "Edit as JSON": the document itself in a textarea, and Apply to parse it back into the form. */
export function RecipeJsonView({ json, error, disabled, onChange, onApply }: RecipeJsonViewProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="json-view">
      <Muted as="p" className="text-sm">
        The recipe document. Apply parses it and puts it back in the form; Save then stores it.
      </Muted>
      <Textarea
        aria-label="Recipe JSON"
        rows={24}
        spellCheck={false}
        className="font-mono text-xs"
        value={json}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error !== null && (
        <Message intent="danger" title="That document did not parse" data-testid="json-error">
          {error}
        </Message>
      )}
      <div className="flex gap-2">
        <Button type="button" intent="primary" size="sm" disabled={disabled} onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
