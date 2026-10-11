import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { type ReactNode, useId } from "react";
import type { RestyledStep } from "../../../../domain/style";
import type { Choice, Finding } from "./styleSession";

export type StyleStepProps = {
  /** The step's number in the recipe. */
  n: number;
  /** The author's step. */
  original: RestyledStep;
  /** The rewrite as Save would take it, a retyped text included; null when it says exactly what the author's does. */
  rewrite: RestyledStep | null;
  /** The side being taken. */
  choice: Choice;
  /** Whether the rewrite's text was retyped here. */
  edited: boolean;
  findings: readonly Finding[];
  droppedWords: readonly string[];
  editing: boolean;
  /** The rewritten text, for the edit field. */
  draft: string;
  onKeep: () => void;
  onOriginal: () => void;
  onEdit: () => void;
  onDraft: (text: string) => void;
  onDoneEditing: () => void;
};

/**
 * The chosen side of Keep / Original: the toggles' selected fill (the neutral
 * tint's pressed step and its text partner), as the toggles and the home
 * page's Filters button take it. Never brand: Save is the page's one primary
 * action (design-language rule 5).
 */
const CHOSEN = "[--button-bg-hovered:var(--intent-tint-bg-pressed)] [--button-bg:var(--intent-tint-bg-pressed)] [--button-fg:var(--intent-tint-fg-pressed)]";

/** The step columns: the number, the author's words, the rewrite. One column of words on a phone, the two sides stacked. */
export const STEP_COLUMNS = "grid grid-cols-[2.75rem_minmax(0,1fr)] md:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)]";

/** Everything a step says, as the recipe page shows it: the label, the instruction, the supporting line. */
export function StepWords({ step, className }: { step: RestyledStep; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {step.title.trim() !== "" && <span className="font-semibold">{step.title}</span>}
      <span className="leading-relaxed">{step.text}</span>
      {step.summary.trim() !== "" && <span className="text-sm leading-relaxed text-fg-subtle">{step.summary}</span>}
    </div>
  );
}

/** One side of a step: the side being taken sits on the subtle fill, the other reads quieter. */
export function StepSide({ chosen, children, testId }: { chosen: boolean; children: ReactNode; testId?: string }) {
  return (
    <div className={cn("col-start-2 flex min-w-0 flex-col gap-2 px-4 py-3 md:col-start-auto md:py-4", chosen && "bg-bg-subtle")} data-testid={testId}>
      {children}
    </div>
  );
}

/** One step in the Style space: the author's words beside the rewrite, each with the button that takes it. */
export function StyleStep(props: StyleStepProps) {
  const { n, original, rewrite, choice, edited, findings, droppedWords, editing, draft } = props;
  const fieldId = useId();
  const choosable = rewrite !== null;
  const status = rewrite === null ? "Unchanged" : edited ? "Edited" : "";
  return (
    <li className={cn(STEP_COLUMNS, "border-b border-border-subtle last:border-b-0")} data-testid="style-step" data-choice={choosable ? choice : "none"}>
      <span className="row-span-2 pt-3 pl-4 font-display text-lg font-semibold text-fg-subtle md:row-span-1 md:pt-4" aria-hidden="true">
        {n}
      </span>

      <StepSide chosen={choosable && choice === "original"} testId="style-step-original">
        <span className="text-xs font-medium text-fg-subtle md:sr-only">Original, step {n}</span>
        <StepWords step={original} className={cn(choosable && choice !== "original" && "text-fg-subtle")} />
        {choosable && (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              intent="neutral"
              className={cn(choice === "original" && CHOSEN)}
              aria-pressed={choice === "original"}
              aria-label={`Use the original of step ${n}`}
              onClick={props.onOriginal}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10a6 6 0 010 12h-3" />
              </svg>
              Original
            </Button>
          </div>
        )}
      </StepSide>

      <StepSide chosen={choosable && choice === "rewrite"} testId="style-step-rewrite">
        <span className="text-xs font-medium text-fg-subtle" data-testid="style-step-status">
          <span className="md:sr-only">
            Restyled, step {n}
            {status !== "" && " · "}
          </span>
          {status}
        </span>
        {rewrite !== null &&
          (editing ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId} className="text-xs text-fg-subtle">
                Step {n} text
              </label>
              <Textarea
                id={fieldId}
                value={draft}
                onChange={(event) => props.onDraft(event.target.value)}
                autosize
                rows={3}
                className="text-base text-fg-normal"
              />
              <div>
                <Button type="button" variant="outline" intent="neutral" size="sm" onClick={props.onDoneEditing}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <StepWords step={rewrite} className={cn(choice !== "rewrite" && "text-fg-subtle")} />
          ))}
        {findings.map((finding) => (
          <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-step-finding">
            {finding.message} {choice === "rewrite" ? "You kept the rewrite anyway." : "This step keeps the original until you keep the rewrite."}
          </Message>
        ))}
        {rewrite !== null && droppedWords.length > 0 && (
          <Muted as="p" className="text-xs">
            The rewrite no longer uses the author’s {droppedWords.length === 1 ? "word" : "words"} <em>{droppedWords.join(", ")}</em>.
          </Muted>
        )}
        {choosable && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              intent="neutral"
              className={cn(choice === "rewrite" && CHOSEN)}
              aria-pressed={choice === "rewrite"}
              aria-label={`Keep the rewrite of step ${n}`}
              onClick={props.onKeep}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
              Keep
            </Button>
            {choice === "rewrite" && !editing && (
              <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={props.onEdit}>
                Edit
              </Button>
            )}
          </div>
        )}
      </StepSide>
    </li>
  );
}
