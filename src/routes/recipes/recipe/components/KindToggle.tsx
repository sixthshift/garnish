import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useEffect, useState } from "react";
import type { RecipeKind } from "../../../../domain/recipe";
import { useMutate } from "../../../../lib/mutate";
import { toastError } from "../../../../lib/toast";
import { setKind } from "../../../../server/fns/recipes";

export const kindOptions = [
  { value: "rotation", label: "Rotation" },
  { value: "weekend", label: "Weekend" },
] as const;

/** A toggle group's value as a kind: "" is neither pressed, which is not said. Pure. */
export function kindFromValue(value: string): RecipeKind | null {
  return value === "rotation" || value === "weekend" ? value : null;
}

/**
 * How the household cooks this recipe: one of the weeknight regulars, or one
 * worth a weekend. The household's call, never guessed (decisions.md row
 * 191); pressing the chosen one again clears it. Written at once, as the
 * favourite heart is, and put back with a toast if the write fails.
 */
export function KindToggle({ id, kind }: { id: string; kind: RecipeKind | null }) {
  const mutate = useMutate();
  const [current, setCurrent] = useState(kind);
  useEffect(() => setCurrent(kind), [kind]);

  async function choose(value: string) {
    const next = kindFromValue(value);
    const before = current;
    setCurrent(next);
    try {
      await mutate(() => setKind({ data: { id, kind: next } }));
    } catch (error) {
      setCurrent(before);
      toastError("Couldn't update the recipe", error);
    }
  }

  return (
    <ToggleGroup
      type="single"
      appearance="segmented"
      variant="outline"
      size="sm"
      aria-label="How you cook it"
      options={kindOptions}
      value={current ?? ""}
      onValueChange={choose}
      className="self-start"
      data-print="hide"
    />
  );
}
