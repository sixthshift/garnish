import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { SourceStage } from "./SourceStage";

export type PasteSourceProps = {
  text: string;
  busy?: boolean;
  error?: string | null;
  /** Whether a model is configured; without one, only a page's HTML can be read. */
  aiAvailable?: boolean;
  onTextChange: (text: string) => void;
  onRead: () => void;
  onBack: () => void;
};

/**
 * Pasted text's stage: one box. A page's own source goes through the page
 * rungs first, exactly as a successful fetch would, and needs no model; plain
 * text is read by the model. Either way nothing is saved until it is reviewed.
 */
export function PasteSource({ text, busy, error, aiAvailable = false, onTextChange, onRead, onBack }: PasteSourceProps) {
  return (
    <SourceStage
      stage="paste"
      title="Paste the recipe"
      errorTitle="That text could not be read"
      error={error}
      busy={busy}
      action="Read the text"
      canSubmit={text.trim() !== ""}
      onSubmit={onRead}
      onBack={onBack}
    >
      <Textarea
        name="text"
        rows={10}
        aria-label="Pasted recipe"
        placeholder={
          aiAvailable
            ? "Anzac biscuits&#10;&#10;1 cup plain flour&#10;125 g butter&#10;&#10;Mix the dry ingredients…".replaceAll("&#10;", "\n")
            : "<!doctype html>…"
        }
        value={text}
        disabled={busy}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <Muted as="p" className="text-sm">
        {aiAvailable
          ? "The whole recipe, ingredients and method in any order. If a site blocked the import, paste the page's HTML instead: view source, select all, copy."
          : "The page's HTML, when a site blocked the import: view source, select all, copy. Reading plain text needs a model (AI_API_KEY)."}
      </Muted>
    </SourceStage>
  );
}
