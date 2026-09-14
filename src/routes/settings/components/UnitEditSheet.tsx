// The Units tab's editor sheet: name, plural, abbreviation, use abbreviation
// and fraction — the fields M15.3 puts in the table. `standardQuantity` and
// `standardUnitId` (unit conversion) are untouched here; `update` merges a
// patch, so leaving them out of the patch keeps their current values.
//
// Sheet only paints after mounting on the client, so the form lives in
// `UnitEditSheetContent`, which renders anywhere and is what the tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { useState } from "react";
import type { Unit } from "../../../db/models/unit/repo";

/** What a save hands back: the repository's flat patch shape. */
export type UnitPatch = {
  id: string;
  name: string;
  pluralName: string | null;
  abbreviation: string;
  useAbbreviation: boolean;
  fraction: boolean;
};

export type UnitEditSheetContentProps = {
  unit: Unit;
  onSave: (patch: UnitPatch) => void;
  onCancel: () => void;
  busy?: boolean;
};

export function UnitEditSheetContent({ unit, onSave, onCancel, busy = false }: UnitEditSheetContentProps) {
  const [name, setName] = useState(unit.name);
  const [pluralName, setPluralName] = useState(unit.pluralName ?? "");
  const [abbreviation, setAbbreviation] = useState(unit.abbreviation);
  const [useAbbreviation, setUseAbbreviation] = useState(unit.useAbbreviation);
  const [fraction, setFraction] = useState(unit.fraction);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("Name is required.");
      return;
    }
    onSave({ id: unit.id, name: trimmed, pluralName: pluralName.trim() || null, abbreviation: abbreviation.trim(), useAbbreviation, fraction });
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">{`Edit ${unit.name}`}</h2>
      </Sheet.Header>
      <Sheet.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField label="Name" required feedback={error ? { message: error, intent: "danger" } : undefined}>
            <Input value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label="Plural">
            <Input value={pluralName} disabled={busy} onChange={(event) => setPluralName(event.target.value)} />
          </FormField>
          <FormField label="Abbreviation">
            <Input value={abbreviation} disabled={busy} onChange={(event) => setAbbreviation(event.target.value)} />
          </FormField>
          <Checkbox label="Use abbreviation" checked={useAbbreviation} disabled={busy} onCheckedChange={setUseAbbreviation} />
          <Checkbox label="Fractions" checked={fraction} disabled={busy} onCheckedChange={setFraction} />
        </form>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type UnitEditSheetProps = UnitEditSheetContentProps & { open: boolean };

export function UnitEditSheet({ open, ...props }: UnitEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label={`Edit ${props.unit.name}`}>
      <UnitEditSheetContent {...props} />
    </Sheet>
  );
}
