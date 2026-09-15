import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import type { SourceKind } from "./importSummary";

export type SourceChooserProps = {
  onChoose: (kind: SourceKind) => void;
  disabled?: boolean;
  /** Whether `claude` is installed on the server; without it the paste option is not offered. */
  aiAvailable?: boolean;
};

/** The first stage: the ways a recipe gets here. The pasted one appears only when the AI rung can run. */
export function SourceChooser({ onChoose, disabled, aiAvailable = false }: SourceChooserProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="choose">
      <SectionTitle as="h2">Where is this recipe from?</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          data-source="url"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("url")}
        >
          <span className="block font-medium">A web page</span>
          <Muted as="span" className="mt-1 block text-sm">
            Paste the address. The recipe is read off the page and shown to you before anything is saved.
          </Muted>
        </button>
        <button
          type="button"
          disabled={disabled}
          data-source="file"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("file")}
        >
          <span className="block font-medium">A Mealie or Tandoor export</span>
          <Muted as="span" className="mt-1 block text-sm">
            Upload a backup or a single recipe file. Everything it holds is shown to you before anything is saved.
          </Muted>
        </button>
        {aiAvailable && (
          <button
            type="button"
            disabled={disabled}
            data-source="paste"
            className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
            onClick={() => onChoose("paste")}
          >
            <span className="block font-medium">Pasted text</span>
            <Muted as="span" className="mt-1 block text-sm">
              A photo's text, an email, a page that gave nothing up. Claude reads it here on the server, and you check it before anything is saved.
            </Muted>
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          data-source="manual"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("manual")}
        >
          <span className="block font-medium">My own</span>
          <Muted as="span" className="mt-1 block text-sm">
            Start with a blank recipe and type it in.
          </Muted>
        </button>
      </div>
    </div>
  );
}
