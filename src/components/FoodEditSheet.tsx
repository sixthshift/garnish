// The Foods tab's editor sheet: every field on the repository's flat shape
// (`aisleId`, not the recipe document's nested `aisle` object). The design
// system's Select only picks from fixed options, so aisle uses the local
// Combobox with its "create" row wired to an `onCreateAisle` callback — Mealie
// lets you type a new aisle name inline while assigning one to a food.
//
// Aliases are edited as a textarea, one per line; converted to/from the
// stored array by the pure helpers below.
//
// Sheet only paints after mounting on the client, so the form lives in
// `FoodEditSheetContent`, which renders anywhere and is what the tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import type { Food } from "../db/models/food/repo";
import type { Aisle } from "../domain/recipe";
import { Combobox } from "./ui/Combobox";

/** Aliases as they are edited: one per line, blank lines dropped, each trimmed. Pure. */
export function parseAliases(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Aliases as the textarea shows them. Pure. */
export function aliasesText(aliases: readonly string[]): string {
  return aliases.join("\n");
}

/** What a save hands back: the repository's flat patch shape. */
export type FoodPatch = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  skipShopping: boolean;
};

export type FoodEditSheetContentProps = {
  food: Food;
  aisles: readonly Aisle[];
  onSave: (patch: FoodPatch) => void;
  onCancel: () => void;
  /** Creates (or finds) an aisle by name, for the Combobox's "Create" row. */
  onCreateAisle: (name: string) => Promise<Aisle>;
  busy?: boolean;
};

export function FoodEditSheetContent({ food, aisles, onSave, onCancel, onCreateAisle, busy = false }: FoodEditSheetContentProps) {
  const [name, setName] = useState(food.name);
  const [pluralName, setPluralName] = useState(food.pluralName ?? "");
  const [aliases, setAliases] = useState(() => aliasesText(food.aliases));
  const [skipShopping, setSkipShopping] = useState(food.skipShopping);
  const [aisleId, setAisleId] = useState(food.aisleId);
  const [aisleText, setAisleText] = useState(() => aisles.find((aisle) => aisle.id === food.aisleId)?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("Name is required.");
      return;
    }
    onSave({ id: food.id, name: trimmed, pluralName: pluralName.trim() || null, aliases: parseAliases(aliases), aisleId, skipShopping });
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">{`Edit ${food.name}`}</h2>
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
          <FormField label="Aisle" description="Type to pick one, or create a new one.">
            <Combobox
              value={aisleText}
              options={aisles.map((aisle) => ({ value: aisle.id, label: aisle.name }))}
              disabled={busy}
              aria-label="Aisle"
              placeholder="None"
              onChange={(text) => {
                setAisleText(text);
                if (text.trim() === "") setAisleId(null);
              }}
              onSelect={(option) => {
                setAisleId(option.value);
                setAisleText(option.label);
              }}
              onCreate={(text) => {
                void onCreateAisle(text).then((aisle) => {
                  setAisleId(aisle.id);
                  setAisleText(aisle.name);
                });
              }}
            />
          </FormField>
          <FormField label="Aliases" description="One per line.">
            <Textarea value={aliases} disabled={busy} onChange={(event) => setAliases(event.target.value)} />
          </FormField>
          <Checkbox label="Skip shopping" checked={skipShopping} disabled={busy} onCheckedChange={setSkipShopping} />
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

export type FoodEditSheetProps = FoodEditSheetContentProps & { open: boolean };

export function FoodEditSheet({ open, ...props }: FoodEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label={`Edit ${props.food.name}`}>
      <FoodEditSheetContent {...props} />
    </Sheet>
  );
}
