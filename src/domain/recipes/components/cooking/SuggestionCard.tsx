import { Card } from "@sixthshift/design-system/card";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { type Decision, decisionsFor, type Suggestion, type SuggestionView } from "../../cooking";

const DECISION_LABEL: Record<Decision, string> = { keep: "Keep in recipe", once: "Just this time", alternative: "Add as an alternative" };

/**
 * One suggested change on the review (decisions.md row 214): what it changes,
 * before and after as the cook saw them, why it is suggested, and the choice
 * it is on — Keep in recipe, Just this time, or for a swap Add as an alternative.
 */
export function SuggestionCard({
  suggestion,
  view,
  decision,
  onDecide,
}: {
  suggestion: Suggestion;
  view: SuggestionView;
  decision: Decision;
  onDecide: (decision: Decision) => void;
}) {
  const choices = decisionsFor(suggestion.adjustment);
  return (
    <Card size="md" className="flex flex-col gap-3" data-testid="suggestion" data-kind={suggestion.adjustment.kind} data-decision={decision}>
      <Muted as="p" className="text-xs font-semibold tracking-wide uppercase">
        {view.label}
      </Muted>
      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {view.before !== null && (
          <>
            <dt className="text-xs text-fg-subtle">Was</dt>
            <dd className="text-fg-subtle line-through decoration-border-strong">{view.before}</dd>
          </>
        )}
        <dt className="text-xs text-fg-subtle">{view.before === null ? "Add" : decision === "once" ? "Tonight" : "Now"}</dt>
        <dd className="text-fg-strong">{view.after}</dd>
      </dl>
      {suggestion.why.trim() !== "" && (
        <p className="rounded-md bg-bg-subtle px-3 py-2 text-xs text-fg-normal">
          <span className="font-semibold">Why: </span>
          {suggestion.why}
        </p>
      )}
      <fieldset className="flex flex-wrap self-start overflow-hidden rounded-lg border border-border-normal">
        <legend className="sr-only">{`What to do with: ${suggestion.adjustment.summary}`}</legend>
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            aria-pressed={decision === choice}
            onClick={() => onDecide(choice)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium",
              index > 0 && "border-l border-border-normal",
              decision === choice ? "bg-bg-brand text-fg-on-brand" : "bg-bg-normal text-fg-normal hover:bg-bg-subtle"
            )}
          >
            {DECISION_LABEL[choice]}
          </button>
        ))}
      </fieldset>
    </Card>
  );
}
