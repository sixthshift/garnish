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
 * A recipe file's stage: one recipe's JSON, or a zip holding just one, from
 * Mealie or Tandoor, told apart by what is in it rather than by its name. A
 * whole export is Settings › Backup's (decisions.md row 201).
 */
export function FileSource({ file, busy, error, onFileChange, onRead, onBack }: FileSourceProps) {
  const inputId = "import-file";
  return (
    <SourceStage
      stage="file"
      title="Upload a recipe file"
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
        aria-label="Recipe file"
        className="sr-only"
        disabled={busy}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <Muted as="p" className="text-sm">
        One recipe exported from Mealie or Tandoor, as <code>.json</code> or <code>.zip</code>. Nothing is saved until you have looked at it. To bring a whole
        backup in, use Settings › Backup.
      </Muted>
    </SourceStage>
  );
}
