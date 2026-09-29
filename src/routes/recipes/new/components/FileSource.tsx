import { Muted } from "@sixthshift/design-system/muted";
import { SourceStage } from "./SourceStage";

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
 * An export's stage: one file. A Mealie backup zip or one recipe's JSON, or
 * Tandoor's export zip — a `recipe.json` per recipe — told apart by what is
 * in it rather than by its name.
 */
export function FileSource({ file, busy, error, onFileChange, onRead, onBack }: FileSourceProps) {
  const inputId = "import-file";
  return (
    <SourceStage
      stage="file"
      title="Upload an export"
      errorTitle="That file could not be read"
      error={error}
      busy={busy}
      action="Read the file"
      canSubmit={file !== null}
      onSubmit={onRead}
      onBack={onBack}
    >
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border-normal px-4 py-8 text-center hover:bg-bg-subtle"
      >
        <span className="font-medium">{file === null ? "Choose file" : "Choose another file"}</span>
        <span className="text-sm text-fg-subtle" data-testid="import-file-name">
          {file === null ? "No file chosen" : file.name}
        </span>
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
      <Muted as="p" className="text-sm">
        A Mealie backup or a Tandoor export <code>.zip</code>, or a single recipe saved as JSON. Nothing is saved until you have looked at it.
      </Muted>
    </SourceStage>
  );
}
