import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";

export type PasteSourceProps = {
  text: string;
  busy?: boolean;
  error?: string | null;
  onTextChange: (text: string) => void;
  onRead: () => void;
  onBack: () => void;
};

/**
 * The second stage for pasted text: one box. What is in it goes to the
 * model on the server and comes back as the same reviewable recipe a scraped
 * page does — and if what was pasted is a page's own source, through
 * the page rungs first, which is why the label asks for either. Nothing here
 * is saved, and the note says so, because handing a recipe to a model is
 * exactly the moment to be told what happens next.
 */
export function PasteSource({ text, busy, error, onTextChange, onRead, onBack }: PasteSourceProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="paste">
      <SectionTitle as="h2">From pasted text</SectionTitle>
      <Muted as="p" className="text-sm">
        Paste the whole recipe — ingredients and method together, in any order. If a site turned the address away, view its source, select all and paste that
        instead: the page's own data is read first, exactly as a successful fetch would have read it. Either way the model fills this app's fields and you check
        every line before anything is saved.
      </Muted>
      <FormField label="The recipe, or the page's HTML (view source, select all, copy)">
        <Textarea
          name="text"
          rows={12}
          aria-label="Pasted recipe"
          placeholder="Anzac biscuits&#10;&#10;1 cup plain flour&#10;125 g butter&#10;&#10;Mix the dry ingredients…"
          value={text}
          disabled={busy}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </FormField>
      {error != null && (
        <Message intent="danger" title="That text could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy || text.trim() === ""} onClick={onRead}>
          {busy ? "Reading…" : "Read the text"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
