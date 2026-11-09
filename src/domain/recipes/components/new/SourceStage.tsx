import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import type { FormEvent, ReactNode } from "react";

export type SourceStageProps = {
  /** Which source this is, for `data-source-stage`. */
  stage: "url" | "paste" | "file" | "page";
  title: string;
  /** The title of the error message; none when the error is a whole sentence of its own. */
  errorTitle?: string;
  error?: string | null;
  /** A way on from the error, drawn inside its message. */
  errorAction?: ReactNode;
  busy?: boolean;
  /** The primary action's label, and its label while busy. */
  action: string;
  busyAction?: string;
  canSubmit: boolean;
  onSubmit: () => void;
  /** End the model's sort and go on without it: offered only while it runs (decisions.md row 203). */
  onSkip?: () => void;
  onBack: () => void;
  children: ReactNode;
};

/** Back to the chooser, above a source's card: the way out sits where a phone's thumb and a reader's eye start, and the card ends on its one action. */
export function StageBack({ onBack, disabled }: { onBack: () => void; disabled?: boolean }) {
  return (
    <div>
      <Button type="button" variant="ghost" intent="neutral" size="sm" className="-ml-2" disabled={disabled} onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back
      </Button>
    </div>
  );
}

/**
 * One source's stage: Back above a card holding its title, its one input and
 * what to know about it, any error, then the stage's one action. The sources
 * share it so they read as one flow rather than bare forms.
 */
export function SourceStage({
  stage,
  title,
  errorTitle,
  error,
  errorAction,
  busy,
  action,
  busyAction = "Reading…",
  canSubmit,
  onSubmit,
  onSkip,
  onBack,
  children,
}: SourceStageProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };
  return (
    <form data-source-stage={stage} onSubmit={submit} className="flex flex-col gap-3">
      <StageBack onBack={onBack} disabled={busy} />
      <Card size="lg" className="flex flex-col gap-4 mobile:p-4">
        <h2 className="text-lg font-medium">{title}</h2>
        {children}
        {error != null && (
          <Message intent="danger" title={errorTitle} data-testid="import-error">
            {errorAction ? (
              <span className="flex flex-col items-start gap-2">
                <span>{error}</span>
                {errorAction}
              </span>
            ) : (
              error
            )}
          </Message>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onSkip !== undefined && (
            <Button type="button" variant="ghost" intent="neutral" onClick={onSkip}>
              Skip sorting into parts
            </Button>
          )}
          <Button type="submit" variant="solid" intent="brand" disabled={busy || !canSubmit}>
            {busy ? busyAction : action}
          </Button>
        </div>
      </Card>
    </form>
  );
}
