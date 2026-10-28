import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { useState } from "react";
import { formatUnit } from "../../../../../domain/ingredient";
import type { Ingredient } from "../../../../../domain/recipe";

/**
 * An ingredient's amount as a field, starting at what the deck shows: Save
 * hands back the number typed (a comma reads as a decimal point), Cancel or
 * anything that is not a positive number hands back nothing. Shared by the
 * ingredients card's pencil and a step card's "Change an amount".
 */
export function AmountForm({ ingredient, onSave, onClose }: { ingredient: Ingredient; onSave: (typed: number) => void; onClose: () => void }) {
  const [typed, setTyped] = useState(String(Number((ingredient.quantity ?? 0).toFixed(2))));
  const amount = Number(typed.replace(",", "."));
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (Number.isFinite(amount) && amount > 0) onSave(amount);
        onClose();
      }}
    >
      <Input
        inputMode="decimal"
        aria-label={`How much ${ingredient.food?.name ?? "of it"} you used`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="w-28 text-2xl"
        autoFocus
      />
      <span className="text-xl">{[formatUnit(amount || ingredient.quantity, ingredient.unit), ingredient.food?.name].filter(Boolean).join(" ")}</span>
      <Button type="submit" variant="solid" intent="neutral" size="xl">
        Save
      </Button>
      <Button type="button" variant="ghost" intent="neutral" size="xl" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
