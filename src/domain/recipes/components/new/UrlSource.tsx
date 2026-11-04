import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SourceStage } from "./SourceStage";

export type UrlSourceProps = {
  url: string;
  busy?: boolean;
  error?: string | null;
  onUrlChange: (url: string) => void;
  onFetch: () => void;
  onBack: () => void;
  /** Paste the recipe instead: the first way on from a failed read (decisions.md row 202). */
  onPaste?: () => void;
  /** Set up the Save to Garnish bookmark: offered once a read has failed, after paste, since a blocked site is why it exists. */
  onBookmark?: () => void;
  /** Whether a model is configured: without one a paste reads only a page's HTML, and the offer says so. */
  aiAvailable?: boolean;
};

/** A web page's stage: one address. Reached from the chooser's field, or a share, once reading has begun. */
export function UrlSource({ url, busy, error, onUrlChange, onFetch, onBack, onPaste, onBookmark, aiAvailable = false }: UrlSourceProps) {
  const ways = onPaste !== undefined || onBookmark !== undefined;
  return (
    <SourceStage
      stage="url"
      title="Import from a web page"
      errorTitle="That page could not be read"
      error={error}
      errorAction={
        ways && (
          <span className="flex flex-wrap gap-2">
            {onPaste && (
              <Button type="button" variant="outline" intent="neutral" size="sm" disabled={busy} onClick={onPaste}>
                {aiAvailable ? "Paste it instead" : "Paste the page's HTML instead"}
              </Button>
            )}
            {onBookmark && (
              <Button type="button" variant="outline" intent="neutral" size="sm" disabled={busy} onClick={onBookmark}>
                <span aria-hidden="true">🌿</span> Send it from your browser
              </Button>
            )}
          </span>
        )
      }
      busy={busy}
      action="Read the page"
      canSubmit={url.trim() !== ""}
      onSubmit={onFetch}
      onBack={onBack}
    >
      <Input
        name="url"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://"
        aria-label="Recipe address"
        value={url}
        disabled={busy}
        onChange={(event) => onUrlChange(event.target.value)}
      />
      <Muted as="p" className="text-sm">
        {busy ? "Reading the page…" : "The recipe is read off the page and shown to you before anything is saved."}
      </Muted>
    </SourceStage>
  );
}
