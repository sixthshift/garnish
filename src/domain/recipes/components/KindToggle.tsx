import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useEffect, useState } from "react";
import { setKind } from "../../../api/rpc/recipes";
import { useMutate } from "../../../lib/mutate";
import { toastError } from "../../../lib/toast";
import type { RecipeKind } from "../recipe";

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
 * favourite heart is, and put back with a toast if the write fails. The
 * recipe page's one is "How you cook it"; the Recipes grid names each after
 * its recipe, so a list of them reads apart.
 */
export function KindToggle({ id, kind, label = "How you cook it" }: { id: string; kind: RecipeKind | null; label?: string }) {
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

  return <KindChoice kind={current} label={label} onChange={(next) => void choose(next ?? "")} />;
}

/**
 * The two segments alone, controlled: what the recipe page writes at once and
 * the editor keeps in its draft until Save (decisions.md row 191). Pressing
 * the chosen one again clears it.
 */
export function KindChoice({
  kind,
  onChange,
  label = "How you cook it",
  disabled,
}: {
  kind: RecipeKind | null;
  onChange: (kind: RecipeKind | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      appearance="segmented"
      variant="outline"
      size="sm"
      aria-label={label}
      options={kindOptions}
      value={kind ?? ""}
      disabled={disabled}
      onValueChange={(value) => onChange(kindFromValue(value))}
      className="self-start"
      data-print="hide"
    />
  );
}
