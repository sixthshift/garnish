import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import type { SentPage } from "./bookmarklet";
import { SourceStage } from "./SourceStage";
import type { SentPageStatus } from "./useSentPage";

export type PageSourceProps = {
  sent: SentPage | null;
  status: SentPageStatus;
  busy?: boolean;
  error?: string | null;
  onRead: () => void;
  onPaste: () => void;
  onBack: () => void;
};

/**
 * Where the Save to Garnish bookmark lands: waiting for the recipe's tab to
 * send its page, then reading it at once. Back from the review returns here,
 * with the page kept, to read it again.
 */
export function PageSource({ sent, status, busy, error, onRead, onPaste, onBack }: PageSourceProps) {
  return (
    <SourceStage
      stage="page"
      title="From your browser"
      errorTitle="That page could not be read"
      error={error}
      busy={busy}
      action="Read the page"
      canSubmit={sent !== null}
      onSubmit={onRead}
      onBack={onBack}
    >
      {sent !== null ? (
        <p className="flex flex-col">
          <span className="font-medium">{sent.title.trim() || "The page"}</span>
          <Muted as="span" className="break-all text-sm">
            {sent.url}
          </Muted>
        </p>
      ) : status === "waiting" ? (
        <p className="flex items-center gap-3">
          <Spinner size="sm" />
          <span>Waiting for the page…</span>
        </p>
      ) : (
        <Message intent="warning" title={status === "orphan" ? "No page to read" : "The page did not answer"}>
          <span className="flex flex-col items-start gap-2">
            <span>
              {status === "orphan"
                ? "This tab was not opened by the Save to Garnish bookmark, or the site cut the link between its tab and this one."
                : "Some sites cut the link between their tab and this one."}{" "}
              Pasting the page's HTML reads the same.
            </span>
            <Button type="button" variant="outline" intent="neutral" size="sm" onClick={onPaste}>
              Paste instead
            </Button>
          </span>
        </Message>
      )}
    </SourceStage>
  );
}
