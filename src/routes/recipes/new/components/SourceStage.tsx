import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { Message } from "@sixthshift/design-system/message";
import type { FormEvent, ReactNode } from "react";

export type SourceStageProps = {
  /** Which source this is, for `data-source-stage`. */
  stage: "url" | "paste" | "file";
  title: string;
  /** The title of the error message, when there is one. */
  errorTitle: string;
  error?: string | null;
  busy?: boolean;
  /** The primary action's label, and its label while busy. */
  action: string;
  busyAction?: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  children: ReactNode;
};

/**
 * One source's stage: a card holding its title, its one input and what to know
 * about it, any error, then Back and the stage's one action. The three sources
 * share it so they read as one flow rather than three bare forms.
 */
export function SourceStage({
  stage,
  title,
  errorTitle,
  error,
  busy,
  action,
  busyAction = "Reading…",
  canSubmit,
  onSubmit,
  onBack,
  children,
}: SourceStageProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !busy) onSubmit();
  };
  return (
    <form data-source-stage={stage} onSubmit={submit}>
      <Card size="lg" className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{title}</h2>
        {children}
        {error != null && (
          <Message intent="danger" title={errorTitle} data-testid="import-error">
            {error}
          </Message>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
            Back
          </Button>
          <Button type="submit" variant="solid" intent="brand" disabled={busy || !canSubmit}>
            {busy ? busyAction : action}
          </Button>
        </div>
      </Card>
    </form>
  );
}
