import { Button } from "@sixthshift/design-system/button";
import { Muted } from "@sixthshift/design-system/muted";
import { addStep, canSplitAll, type DraftPart, mergeAllSteps, type RecipeDraft, splitAllSteps, suggestPartLinks } from "../../../domain/draft";

type DraftStep = DraftPart["steps"][number];

import { notify } from "../../../lib/notify";
import { suggestNotice } from "./stepsEditorText";

export type StepsEditorActionsProps = {
  heading: string;
  draft: RecipeDraft;
  pi: number;
  steps: readonly DraftStep[];
  /** How many ingredient rows the part has; "Suggest links" needs at least one. */
  ingredientCount: number;
  disabled?: boolean;
  onChange: (draft: RecipeDraft) => void;
  onBulkAdd: () => void;
};

/** The section header: the heading and the list actions, once above the list. */
export function StepsEditorActions({ heading, draft, pi, steps, ingredientCount, disabled, onChange, onBulkAdd }: StepsEditorActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
        {heading}
      </Muted>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          intent="neutral"
          size="sm"
          disabled={disabled || steps.length === 0 || ingredientCount === 0}
          onClick={() => {
            const suggested = suggestPartLinks(draft, pi);
            onChange(suggested.draft);
            notify({ intent: suggested.filled === 0 ? "neutral" : "success", title: suggestNotice(suggested.filled) });
          }}
        >
          Suggest links
        </Button>
        <Button
          type="button"
          variant="ghost"
          intent="neutral"
          size="sm"
          disabled={disabled || !canSplitAll(steps)}
          onClick={() => onChange(splitAllSteps(draft, pi))}
        >
          Split all
        </Button>
        <Button
          type="button"
          variant="ghost"
          intent="neutral"
          size="sm"
          disabled={disabled || steps.length < 2}
          onClick={() => onChange(mergeAllSteps(draft, pi))}
        >
          Merge all
        </Button>
        <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={onBulkAdd}>
          Bulk add
        </Button>
        <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addStep(draft, pi))}>
          Add step
        </Button>
      </div>
    </div>
  );
}
