import { Button } from "@sixthshift/design-system/button";
import { toast } from "@sixthshift/design-system/overlay";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import type { Recipe } from "../../../../../domain/recipe";
import { useMutate } from "../../../../../lib/mutate";
import { toastError } from "../../../../../lib/toast";
import { saveQuickEdit } from "../../components/saveQuickEdit";
import { type ChangeDecision, type CookChange, changeKey, describeChange, keptChanges, keptDraft, onceNote } from "./cookChanges";

const DECISIONS = [
  { value: "keep", label: "Keep in recipe" },
  { value: "once", label: "Just this time" },
] as const;

/**
 * What changed at the stove, each with Keep in recipe (the default) or Just
 * this time, and one Save: the kept ones are written into the recipe through
 * the quick edit's save, the rest go into the cook log's comment when Made
 * this is pressed (decisions.md row 193). `onSaved` hands back that comment.
 */
export function ChangesReview({ stored, changes, onSaved }: { stored: Recipe; changes: readonly CookChange[]; onSaved: (note: string) => void }) {
  const mutate = useMutate();
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>({});
  const [busy, setBusy] = useState(false);
  const kept = keptChanges(changes, decisions);

  const save = async () => {
    setBusy(true);
    try {
      if (kept.length > 0) await saveQuickEdit(keptDraft(stored, kept), mutate);
      if (kept.length > 0) toast({ intent: "success", title: kept.length === 1 ? "1 change kept in the recipe" : `${kept.length} changes kept in the recipe` });
      onSaved(onceNote(changes, decisions));
    } catch (error) {
      toastError("Couldn't update the recipe", error);
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="changes" className="flex w-full flex-col gap-3 text-left">
      <SectionTitle as="h2" id="changes">
        What you changed
      </SectionTitle>
      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-normal">
        {changes.map((change) => {
          const key = changeKey(change);
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-0 flex-[1_1_14rem] text-lg">{describeChange(change)}</span>
              <ToggleGroup
                type="single"
                appearance="segmented"
                variant="outline"
                size="md"
                aria-label={`What to do with: ${describeChange(change)}`}
                options={DECISIONS}
                value={decisions[key] ?? "keep"}
                onValueChange={(value) => value !== "" && setDecisions({ ...decisions, [key]: value === "once" ? "once" : "keep" })}
              />
            </li>
          );
        })}
      </ul>
      <Button type="button" intent="brand" size="xl" className="self-start" disabled={busy} onClick={() => void save()}>
        {kept.length === 0 ? "Done" : kept.length === 1 ? "Keep 1 change" : `Keep ${kept.length} changes`}
      </Button>
    </section>
  );
}
