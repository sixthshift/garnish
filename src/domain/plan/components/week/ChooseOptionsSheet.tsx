// What a plan entry makes its recipe with (decisions.md row 198): for each
// row with options, which food this time. Opened from the entry's menu.

import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { RadioButtonGroup } from "@sixthshift/design-system/radio-button-group";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useEffect, useState } from "react";
import { updatePlanEntry } from "../../../../api/rpc/plan";
import { getRecipe } from "../../../../api/rpc/recipes";
import { SaveFooter } from "../../../../components/ui/EditSheet";
import { useMutate } from "../../../../lib/mutate";
import { formatIngredient } from "../../../recipes/ingredient";
import { choiceRows, type Recipe, rowChoices } from "../../../recipes/recipe";
import type { PlanEntry } from "../../plan";

export function ChooseOptionsSheet({ entry, open, onOpenChange }: { entry: PlanEntry; open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutate = useMutate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slug = entry.recipe?.slug;

  useEffect(() => {
    if (!open || slug === undefined) return;
    let stale = false;
    setError(null);
    getRecipe({ data: { slug } })
      .then((doc) => {
        if (stale) return;
        setRecipe(doc);
        // Every row starts on what the entry chose, or on its own food.
        setPicked(Object.fromEntries(choiceRows(doc).map((row) => [row.id, entry.choices[row.id] ?? row.food!.id])));
      })
      .catch(() => !stale && setError("Couldn't load the recipe."));
    return () => {
      stale = true;
    };
  }, [open, slug, entry.choices]);

  const save = async () => {
    setBusy(true);
    try {
      await mutate(() => updatePlanEntry({ data: { id: entry.id, choices: picked } }));
      onOpenChange(false);
    } catch {
      setError("Couldn't save the choice.");
    } finally {
      setBusy(false);
    }
  };

  const rows = recipe === null ? [] : choiceRows(recipe);
  const name = entry.recipe?.name ?? entry.text;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} size="sm" closable aria-label={`Choose for ${name}`}>
      <Sheet.Header>
        <h2 className="text-base font-medium">{name}</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-4">
          {recipe === null && error === null && <Muted as="p">Loading…</Muted>}
          {recipe !== null && rows.length === 0 && <Muted as="p">This recipe has no options to choose from.</Muted>}
          {rows.map((row) => {
            const choices = rowChoices(row);
            return (
              <fieldset key={row.id} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Made with</legend>
                <RadioButtonGroup
                  aria-label={`Made with, instead of ${row.food!.name}`}
                  value={picked[row.id]}
                  onValueChange={(value) => setPicked((current) => ({ ...current, [row.id]: value }))}
                  options={choices.map((option) => ({
                    value: option.food.id,
                    label: formatIngredient({
                      quantity: option.quantity ?? row.quantity,
                      // The line's own food, or an option at the line's amount, keeps its range.
                      quantityMax: option.quantity === null || option.food.id === row.food!.id ? row.quantityMax : null,
                      unit: option.quantity === null ? row.unit : option.unit,
                      food: option.food,
                      note: "",
                      originalText: "",
                    }),
                  }))}
                />
              </fieldset>
            );
          })}
          {error !== null && <Message intent="danger">{error}</Message>}
        </div>
      </Sheet.Body>
      <SaveFooter busy={busy} canSave={rows.length > 0} onCancel={() => onOpenChange(false)} onSave={() => void save()} />
    </Sheet>
  );
}
