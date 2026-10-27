import { Button } from "@sixthshift/design-system/button";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { useState } from "react";
import { formatAmount } from "../../../domain/ingredient";
import type { Food, FoodPackInput, Unit } from "../../../domain/reference";
import type { PackSize } from "../../../domain/shopping";

/** The Select's value for a size counted in the food itself. */
const EACH = "each";

/**
 * "Sold in" under a food line in the aisle view: the sizes the food comes in,
 * and a size added from the shelf — an amount, a unit or "each", and Add —
 * written as the food's whole list of sizes. Settings › Foods edits them in
 * full (decisions.md row 184).
 */
export function SoldInForm({
  food,
  sizes,
  units,
  busy,
  onSetSizes,
}: {
  food: Food;
  sizes: readonly PackSize[];
  units: readonly Unit[];
  busy: boolean;
  onSetSizes: (foodId: string, packs: FoodPackInput[]) => void;
}) {
  const [amount, setAmount] = useState("");
  const [unitId, setUnitId] = useState("");
  const quantity = Number(amount.trim());
  const ready = amount.trim() !== "" && Number.isFinite(quantity) && quantity > 0 && unitId !== "";

  const add = () => {
    if (!ready) return;
    const current = sizes.map((size) => ({ quantity: size.quantity, unitId: size.unit?.id ?? null }));
    onSetSizes(food.id, [...current, { quantity, unitId: unitId === EACH ? null : unitId }]);
    setAmount("");
    setUnitId("");
  };

  return (
    <div className="flex flex-col gap-1" data-testid="shopping-sold-in">
      <Muted as="span">{sizes.length === 0 ? "Sold in" : `Sold in ${sizes.map((size) => formatAmount(size.quantity, size.unit) || "1").join(", ")}`}</Muted>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-20"
          inputMode="decimal"
          value={amount}
          disabled={busy}
          aria-label={`Size ${food.name} is sold in`}
          placeholder="250"
          onChange={(event) => setAmount(event.target.value)}
        />
        <Select
          aria-label={`Unit of the size ${food.name} is sold in`}
          placeholder="Unit"
          options={[{ value: EACH, label: "each" }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))]}
          value={unitId}
          disabled={busy}
          onValueChange={setUnitId}
        />
        <Button type="button" variant="ghost" intent="brand" size="sm" disabled={busy || !ready} onClick={add}>
          Add size
        </Button>
      </div>
    </div>
  );
}
