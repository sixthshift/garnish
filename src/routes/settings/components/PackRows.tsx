import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import type { Dispatch, SetStateAction } from "react";
import type { Unit } from "../../../db/models/unit/repo";
import { blankPack, EACH, type PackDraft } from "./foodEditDraft";

export type PackRowsProps = {
  packs: PackDraft[];
  /** Every unit, for the Select beside "each". */
  units: readonly Unit[];
  busy: boolean;
  onChange: Dispatch<SetStateAction<PackDraft[]>>;
};

/** The food sheet's "Sold in": the sizes the shopping list rounds a line up to (decisions.md row 184). */
export function PackRows({ packs, units, busy, onChange: setPacks }: PackRowsProps) {
  const unitOptions = [{ value: EACH, label: "each" }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))];

  const patchPack = (key: string, patch: Partial<PackDraft>) => setPacks((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      <FormField label="Sold in" description="The sizes the shop sells — butter in 250 g, eggs in 6 and 12. The shopping list rounds up to whole packs.">
        <div className="flex flex-col gap-2">
          {packs.length === 0 ? (
            <Muted>No sizes.</Muted>
          ) : (
            packs.map((row, index) => (
              <div key={row.key} className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-20"
                  inputMode="decimal"
                  value={row.quantity}
                  disabled={busy}
                  aria-label={`Size ${index + 1} amount`}
                  onChange={(event) => patchPack(row.key, { quantity: event.target.value })}
                />
                <Select
                  aria-label={`Size ${index + 1} unit`}
                  options={unitOptions}
                  value={row.unitId}
                  disabled={busy}
                  onValueChange={(value) => patchPack(row.key, { unitId: value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  intent="neutral"
                  size="sm"
                  disabled={busy}
                  aria-label={`Remove size ${index + 1}`}
                  onClick={() => setPacks((rows) => rows.filter((other) => other.key !== row.key))}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </FormField>
      <div>
        <Button type="button" variant="ghost" intent="brand" size="sm" disabled={busy} onClick={() => setPacks((rows) => [...rows, blankPack()])}>
          Add size
        </Button>
      </div>
    </div>
  );
}
