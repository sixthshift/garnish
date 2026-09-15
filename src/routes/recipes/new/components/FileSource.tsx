import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";

export type FileSourceProps = {
  /** The chosen file, or null before one is picked. */
  file: File | null;
  busy?: boolean;
  error?: string | null;
  onFileChange: (file: File | null) => void;
  onRead: () => void;
  onBack: () => void;
};

/**
 * The second stage for an export: one file. A Mealie backup zip or one
 * recipe's JSON, or Tandoor's export zip — a `recipe.json` per recipe — told
 * apart by what is in it rather than by its name.
 */
export function FileSource({ file, busy, error, onFileChange, onRead, onBack }: FileSourceProps) {
  const inputId = "import-file";
  return (
    <div className="flex flex-col gap-4" data-source-stage="file">
      <SectionTitle as="h2">From a Mealie or Tandoor export</SectionTitle>
      <Muted as="p" className="text-sm">
        A Mealie backup or a Tandoor export <code>.zip</code>, or a single recipe saved as JSON. Nothing is saved until you have looked at it.
      </Muted>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="cursor-pointer rounded-lg border border-border-normal px-3 py-2 text-sm font-medium hover:bg-bg-subtle">
          Choose file
        </label>
        <input
          id={inputId}
          name="file"
          type="file"
          accept=".zip,.json,application/zip,application/json"
          aria-label="Mealie or Tandoor export"
          className="sr-only"
          disabled={busy}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <span className="text-sm text-fg-subtle" data-testid="import-file-name">
          {file === null ? "No file chosen" : file.name}
        </span>
      </div>
      {error != null && (
        <Message intent="danger" title="That file could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy || file === null} onClick={onRead}>
          {busy ? "Reading…" : "Read the file"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
