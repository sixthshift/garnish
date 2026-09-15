import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import type { Dispatch, SetStateAction } from "react";
import type { Unit } from "../../../db/models/unit/repo";
import { blankConversion, type ConversionDraft } from "./foodEditDraft";

export type ConversionRowsProps = {
  conversions: ConversionDraft[];
  /** Every unit, for the two Selects. Empty shows "Add a unit first." */
  units: readonly Unit[];
  busy: boolean;
  onChange: Dispatch<SetStateAction<ConversionDraft[]>>;
};

export function ConversionRows({ conversions, units, busy, onChange: setConversions }: ConversionRowsProps) {
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));

  const patchConversion = (key: string, patch: Partial<ConversionDraft>) =>
    setConversions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      <FormField label="Conversions" description="How much this food weighs by volume — 1 cup of flour is 125 g.">
        <div className="flex flex-col gap-2">
          {units.length === 0 ? (
            <Muted>Add a unit first.</Muted>
          ) : conversions.length === 0 ? (
            <Muted>No conversions.</Muted>
          ) : (
            conversions.map((row, index) => (
              <div key={row.key} className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-16"
                  inputMode="decimal"
                  value={row.quantity}
                  disabled={busy}
                  aria-label={`Conversion ${index + 1} amount`}
                  onChange={(event) => patchConversion(row.key, { quantity: event.target.value })}
                />
                <Select
                  aria-label={`Conversion ${index + 1} unit`}
                  options={unitOptions}
                  value={row.unitId}
                  disabled={busy}
                  onValueChange={(value) => patchConversion(row.key, { unitId: value })}
                />
                <span aria-hidden="true">=</span>
                <Input
                  className="w-16"
                  inputMode="decimal"
                  value={row.toQuantity}
                  disabled={busy}
                  aria-label={`Conversion ${index + 1} equals amount`}
                  onChange={(event) => patchConversion(row.key, { toQuantity: event.target.value })}
                />
                <Select
                  aria-label={`Conversion ${index + 1} equals unit`}
                  options={unitOptions}
                  value={row.toUnitId}
                  disabled={busy}
                  onValueChange={(value) => patchConversion(row.key, { toUnitId: value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  intent="neutral"
                  size="sm"
                  disabled={busy}
                  aria-label={`Remove conversion ${index + 1}`}
                  onClick={() => setConversions((rows) => rows.filter((other) => other.key !== row.key))}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </FormField>
      {units.length > 0 && (
        <div>
          <Button type="button" variant="ghost" intent="brand" size="sm" disabled={busy} onClick={() => setConversions((rows) => [...rows, blankConversion()])}>
            Add conversion
          </Button>
        </div>
      )}
    </div>
  );
}
