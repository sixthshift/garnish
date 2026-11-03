import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Select } from "@sixthshift/design-system/select";
import type { Dispatch, SetStateAction } from "react";
import type { Unit } from "../../../domain/reference";
import { picker } from "../../../lib/ui/picker";
import { type AlternativeDraft, type AlternativeItemDraft, blankItem, NO_UNIT } from "./alternativeDraft";

export type AlternativeRowsProps = {
  alternatives: AlternativeDraft[];
  /** Every unit, for the amounts' Selects. */
  units: readonly Unit[];
  /** The foods a name is picked from; a name none has is created on save. */
  foods: readonly { id: string; name: string }[];
  /** The line's own unit id, which a new food row starts on. */
  lineUnitId: string;
  onChange: Dispatch<SetStateAction<AlternativeDraft[]>>;
};

/**
 * A line's alternatives as they are edited (decisions.md row 199): each one a
 * bordered group of foods with amounts, an optional "per" they are measured
 * against, a note, and whether the plan picks it.
 */
export function AlternativeRows({ alternatives, units, foods, lineUnitId, onChange: setAlternatives }: AlternativeRowsProps) {
  const unitOptions = [{ value: NO_UNIT, label: "no unit" }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))];
  const foodOptions = foods.map((food) => ({ value: food.id, label: food.name }));

  const patch = (key: string, next: Partial<AlternativeDraft>) => setAlternatives((rows) => rows.map((row) => (row.key === key ? { ...row, ...next } : row)));
  const patchItem = (key: string, itemKey: string, next: Partial<AlternativeItemDraft>) =>
    setAlternatives((rows) =>
      rows.map((row) => (row.key === key ? { ...row, items: row.items.map((item) => (item.key === itemKey ? { ...item, ...next } : item)) } : row))
    );

  if (alternatives.length === 0) return <Muted as="p">None yet.</Muted>;

  return (
    <div className="flex flex-col gap-3">
      {alternatives.map((row, index) => {
        const name = `Alternative ${index + 1}`;
        const single = row.items.length === 1;
        return (
          <fieldset key={row.key} className="flex flex-col gap-2 rounded-lg border border-border-normal p-3" aria-label={name}>
            <legend className="px-1 text-sm font-medium">{name}</legend>
            {row.items.map((item, itemIndex) => {
              const itemName = row.items.length === 1 ? `${name} food` : `${name} food ${itemIndex + 1}`;
              return (
                <div key={item.key} className="flex flex-col gap-2">
                  <SearchInput
                    value={item.food}
                    aria-label={itemName}
                    placeholder="Food"
                    onValueChange={(text) => patchItem(row.key, item.key, { food: text })}
                    {...picker({
                      options: foodOptions,
                      text: item.food,
                      label: `${itemName} suggestions`,
                      onSelect: (option) => patchItem(row.key, item.key, { food: option.label }),
                      onCreate: (text) => patchItem(row.key, item.key, { food: text }),
                    })}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-20"
                      inputMode="decimal"
                      placeholder="Same"
                      value={item.quantity}
                      aria-label={`${itemName} amount`}
                      onChange={(event) => patchItem(row.key, item.key, { quantity: event.target.value })}
                    />
                    <Select
                      aria-label={`${itemName} unit`}
                      options={unitOptions}
                      value={item.unitId}
                      className="w-32"
                      onValueChange={(value) => patchItem(row.key, item.key, { unitId: value })}
                    />
                    {!single && (
                      <Button
                        type="button"
                        variant="ghost"
                        intent="neutral"
                        size="sm"
                        aria-label={`Remove ${itemName.toLowerCase()}`}
                        onClick={() => patch(row.key, { items: row.items.filter((other) => other.key !== item.key) })}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <div>
              <Button
                type="button"
                variant="ghost"
                intent="brand"
                size="sm"
                onClick={() => patch(row.key, { items: [...row.items, blankItem(lineUnitId)], planPicks: false })}
              >
                And another food
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Muted as="span" className="text-sm">
                Per
              </Muted>
              <Input
                className="w-20"
                inputMode="decimal"
                placeholder="—"
                value={row.basisQuantity}
                aria-label={`${name} per amount`}
                onChange={(event) => patch(row.key, { basisQuantity: event.target.value })}
              />
              <Select
                aria-label={`${name} per unit`}
                options={unitOptions}
                value={row.basisUnitId}
                className="w-32"
                onValueChange={(value) => patch(row.key, { basisUnitId: value })}
              />
            </div>
            <Input
              value={row.note}
              placeholder="Note, e.g. stand 5 minutes"
              aria-label={`${name} note`}
              onChange={(event) => patch(row.key, { note: event.target.value })}
            />
            <Checkbox
              label="The plan picks it"
              checked={row.planPicks && single}
              disabled={!single}
              onCheckedChange={(checked) => patch(row.key, { planPicks: checked === true })}
            />
            {!single && (
              <Muted as="p" className="text-xs">
                The plan picks single foods only.
              </Muted>
            )}
            <div>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                onClick={() => setAlternatives((rows) => rows.filter((other) => other.key !== row.key))}
              >
                Remove {name.toLowerCase()}
              </Button>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
