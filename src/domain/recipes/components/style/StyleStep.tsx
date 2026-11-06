import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { useId, useState } from "react";
import type { RestyledStep } from "../../style";
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

/** The step's columns: the number, then the words the recipe will have. */
export const STEP_COLUMNS = "grid grid-cols-[2.75rem_minmax(0,1fr)]";

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

/**
 * One step in the Style space, as the recipe will read (decisions.md row 203):
 * the side being taken, with Keep, Original and Edit, and the other side one
 * press away under Show original (or Show the rewrite). A finding says what
 * the rewrite lost; a reworded word is not one.
 */
export function StyleStep(props: StyleStepProps) {
  const { n, original, rewrite, choice, edited, findings, editing, draft } = props;
  const fieldId = useId();
  const [showOther, setShowOther] = useState(false);
  const choosable = rewrite !== null;
  const takingRewrite = choosable && choice === "rewrite";
  const shown = takingRewrite ? rewrite : original;
  const other = !choosable ? null : takingRewrite ? original : rewrite;
  const status = !choosable ? "Unchanged" : takingRewrite ? (edited ? "Edited" : "Rewritten") : "As written";
  return (
    <li className={cn(STEP_COLUMNS, "border-b border-border-subtle last:border-b-0")} data-testid="style-step" data-choice={choosable ? choice : "none"}>
      <span className="pt-3 pl-4 font-display text-lg font-semibold text-fg-subtle md:pt-4" aria-hidden="true">
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3 md:py-4" data-testid={takingRewrite ? "style-step-rewrite" : "style-step-original"}>
        <span className="text-xs font-medium text-fg-subtle" data-testid="style-step-status">
          <span className="sr-only">Step {n}: </span>
          {status}
        </span>
        {editing && takingRewrite ? (
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
          <StepWords step={shown} />
        )}
        {findings.map((finding) => (
          <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-step-finding">
            {finding.message} {takingRewrite ? "You kept the rewrite anyway." : "This step keeps the original until you keep the rewrite."}
          </Message>
        ))}
        {choosable && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              intent="neutral"
              className={cn(choice === "rewrite" && CHOSEN)}
              aria-pressed={takingRewrite}
              aria-label={`Keep the rewrite of step ${n}`}
              onClick={props.onKeep}
            >
              Keep
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              intent="neutral"
              className={cn(choice === "original" && CHOSEN)}
              aria-pressed={!takingRewrite}
              aria-label={`Use the original of step ${n}`}
              onClick={props.onOriginal}
            >
              Original
            </Button>
            {takingRewrite && !editing && (
              <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={props.onEdit}>
                Edit
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              intent="neutral"
              aria-expanded={showOther}
              aria-label={`${takingRewrite ? "Show the original of" : "Show the rewrite of"} step ${n}`}
              onClick={() => setShowOther(!showOther)}
            >
              {showOther ? "Hide" : takingRewrite ? "Show original" : "Show the rewrite"}
            </Button>
          </div>
        )}
        {showOther && other !== null && (
          <div className="flex flex-col gap-1 border-l-2 border-border-normal pl-3" data-testid="style-step-other">
            <span className="text-xs font-medium text-fg-subtle">{takingRewrite ? "Original" : "Rewrite"}</span>
            <StepWords step={other} className="text-fg-subtle" />
          </div>
        )}
      </div>
    </li>
  );
}
