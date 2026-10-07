import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { cn } from "@sixthshift/design-system/utils";
import { useId } from "react";
import type { RestyledStep } from "../../../../domain/style";
import type { Finding } from "./styleSession";

export type StyleStepProps = {
  /** The step's number in the recipe. */
  n: number;
  /** The side on screen. */
  shown: RestyledStep;
  /** The other side, for Compare; absent when there is no other side. */
  other?: { heading: string; step: RestyledStep };
  /** One word or two for what is on screen: "Rewritten", "Original kept", "Restyling…". */
  status: string;
  /** Whether the rewrite is what is on screen, which tints the row. */
  rewriteShown: boolean;
  /** Null when there is nothing to choose: no answer yet, a part chosen whole, or a rewrite that changed nothing. */
  choice: "rewrite" | "original" | null;
  findings: readonly Finding[];
  droppedWords: readonly string[];
  comparing: boolean;
  editing: boolean;
  /** The rewritten text, for the edit field. */
  draft: string;
  pending?: boolean;
  onKeep: () => void;
  onOriginal: () => void;
  onCompare: () => void;
  onEdit: () => void;
  onDraft: (text: string) => void;
  onDoneEditing: () => void;
};

/**
 * The chosen side of Keep / Original: the toggles' selected fill (the neutral
 * tint's pressed step and its text partner), as the Styled/Original toggle and
 * the home page's Filters button take it. Never brand: Save is the page's one
 * primary action (design-language rule 5).
 */
const CHOSEN = "[--button-bg-hovered:var(--intent-tint-bg-pressed)] [--button-bg:var(--intent-tint-bg-pressed)] [--button-fg:var(--intent-tint-fg-pressed)]";

/** Everything a step says, as the recipe page shows it: the label, the instruction, the supporting line. */
function StepWords({ step, className }: { step: RestyledStep; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {step.title.trim() !== "" && <span className="font-semibold">{step.title}</span>}
      <span className="leading-relaxed">{step.text}</span>
      {step.summary.trim() !== "" && <span className="text-sm leading-relaxed text-fg-subtle">{step.summary}</span>}
    </div>
  );
}

/** One step in the Style space: what will be saved, why to look twice, and the two sides to choose between. */
export function StyleStep(props: StyleStepProps) {
  const { n, shown, other, status, rewriteShown, choice, findings, droppedWords, comparing, editing, draft, pending = false } = props;
  const fieldId = useId();
  return (
    <li
      className={cn(
        "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-4 last:border-b-0 md:grid-cols-[1.75rem_minmax(0,1fr)_auto]",
        rewriteShown && "bg-bg-brand-subtle/40"
      )}
      data-testid="style-step"
      data-choice={choice ?? "none"}
    >
      <span className="font-display text-lg font-semibold text-fg-subtle" aria-hidden="true">
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <span className={cn("text-xs font-medium", rewriteShown ? "text-fg-brand" : "text-fg-subtle")} data-testid="style-step-status">
          <span className="sr-only">Step {n}: </span>
          {status}
        </span>
        {editing ? (
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
          <StepWords step={shown} className={cn(pending && "opacity-60")} />
        )}
        {findings.map((finding) => (
          <Message key={`${finding.kind}:${finding.item}`} intent="warning" size="sm" data-testid="style-step-finding">
            {finding.message} {choice === "rewrite" ? "You kept the rewrite anyway." : "This step keeps the original until you keep the rewrite."}
          </Message>
        ))}
        {comparing && other !== undefined && (
          <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-subtle px-3 py-2 text-sm" data-testid="style-step-other">
            <SectionTitle as="h4">{other.heading}</SectionTitle>
            <StepWords step={other.step} className="text-fg-subtle" />
            {droppedWords.length > 0 && (
              <Muted as="p" className="text-xs">
                The rewrite no longer uses the author’s {droppedWords.length === 1 ? "word" : "words"} <em>{droppedWords.join(", ")}</em>.
              </Muted>
            )}
          </div>
        )}
      </div>
      {choice !== null && (
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:flex-col md:items-end">
          <div className="flex gap-1.5">
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
              <span className="md:sr-only">Keep</span>
            </Button>
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
              <span className="md:sr-only">Original</span>
            </Button>
          </div>
          <div className="flex gap-0.5">
            {other !== undefined && (
              <Button type="button" size="sm" variant="ghost" intent="neutral" aria-expanded={comparing} onClick={props.onCompare}>
                {comparing ? "Hide" : "Compare"}
              </Button>
            )}
            {choice === "rewrite" && !editing && (
              <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={props.onEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
