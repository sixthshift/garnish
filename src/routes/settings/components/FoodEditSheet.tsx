// The Foods tab's editor sheet: every field on the repository's flat shape
// (`aisleId`, not the recipe document's nested `aisle` object). The design
// system's Select only picks from fixed options, so aisle uses the local
// Combobox with its "create" row wired to an `onCreateAisle` callback — Mealie
// lets you type a new aisle name inline while assigning one to a food.
//
// Aliases are edited as a textarea, one per line; converted to/from the
// stored array by the pure helpers below.
//
// "Made by a recipe" (M32.3, decisions.md row 70) is the food's `recipeId`: a
// Combobox over the recipe names the Settings loader already has, with no
// "create" row — a recipe is written in the editor, not from here. Clearing
// the field unlinks the food.
//
// Conversions (decisions.md row 69) are edited as rows of quantity, unit,
// equals, quantity, unit — "1 cup of flour is 125 g". They are held as text
// while typing, because a half-typed "12" is not a number anyone meant, and
// turned back into numbers by `parseConversions` on save. Units come from the
// Settings loader, so a fixed-option `Select` is enough; a conversion cannot
// name a unit that does not exist.
//
// Sheet only paints after mounting on the client, so the form lives in
// `FoodEditSheetContent`, which renders anywhere and is what the tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { type Food } from "../../../db/models/food/repo";
import { type Unit } from "../../../db/models/unit/repo";
import { type Aisle, type FoodConversion, type FoodConversionInput } from "../../../domain/reference";
import { Combobox } from "../../../components/ui/Combobox";

/** A recipe as the "Made by a recipe" Combobox offers it. */
export type RecipeOption = { id: string; name: string };

/** What a save hands back: the repository's flat patch shape. */
export type FoodPatch = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  /** The recipe this food is made by (M32.3), or null for an ordinary food. */
  recipeId: string | null;
  skipShopping: boolean;
  /** Replaces the food's conversions wholesale (decisions.md row 69). */
  conversions: FoodConversionInput[];
};

export type FoodEditSheetContentProps = {
  food: Food;
  aisles: readonly Aisle[];
  /** Every unit, for the conversions editor's two Selects. Empty hides the editor. */
  units?: readonly Unit[];
  /** Every recipe, for "Made by a recipe". Empty hides the field. */
  recipes?: readonly RecipeOption[];
  onSave: (patch: FoodPatch) => void;
  onCancel: () => void;
  /** Creates (or finds) an aisle by name, for the Combobox's "Create" row. */
  onCreateAisle: (name: string) => Promise<Aisle>;
  busy?: boolean;
};

export function FoodEditSheetContent({ food, aisles, units = [], recipes = [], onSave, onCancel, onCreateAisle, busy = false }: FoodEditSheetContentProps) {
  const [name, setName] = useState(food.name);
  const [pluralName, setPluralName] = useState(food.pluralName ?? "");
  const [aliases, setAliases] = useState(() => aliasesText(food.aliases));
  const [skipShopping, setSkipShopping] = useState(food.skipShopping);
  const [aisleId, setAisleId] = useState(food.aisleId);
  const [conversions, setConversions] = useState<ConversionDraft[]>(() => food.conversions.map(conversionDraft));
  const [aisleText, setAisleText] = useState(() => aisles.find((aisle) => aisle.id === food.aisleId)?.name ?? "");
  const [recipeId, setRecipeId] = useState(food.recipeId);
  const [recipeText, setRecipeText] = useState(() => recipes.find((recipe) => recipe.id === food.recipeId)?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.name }));

  const patchConversion = (key: string, patch: Partial<ConversionDraft>) =>
    setConversions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("Name is required.");
      return;
    }
    const parsed = parseConversions(conversions);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onSave({
      id: food.id,
      name: trimmed,
      pluralName: pluralName.trim() || null,
      aliases: parseAliases(aliases),
      aisleId,
      recipeId,
      skipShopping,
      conversions: parsed.conversions,
    });
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
          {recipes.length > 0 && (
            <FormField label="Made by a recipe" description="This food is the result of another recipe; leave it blank for an ordinary ingredient.">
              <Combobox
                value={recipeText}
                options={recipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))}
                disabled={busy}
                aria-label="Made by a recipe"
                placeholder="None"
                onChange={(text) => {
                  setRecipeText(text);
                  if (text.trim() === "") setRecipeId(null);
                }}
                onSelect={(option) => {
                  setRecipeId(option.value);
                  setRecipeText(option.label);
                }}
              />
            </FormField>
          )}
          <FormField label="Aliases" description="One per line.">
            <Textarea value={aliases} disabled={busy} onChange={(event) => setAliases(event.target.value)} />
          </FormField>
          <Checkbox label="Skip shopping" checked={skipShopping} disabled={busy} onCheckedChange={setSkipShopping} />
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
                <Button
                  type="button"
                  variant="ghost"
                  intent="brand"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConversions((rows) => [...rows, blankConversion()])}
                >
                  Add conversion
                </Button>
              </div>
            )}
          </div>
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

/** One conversion as it is being typed: every field a string, including the amounts. */
export type ConversionDraft = { key: string; quantity: string; unitId: string; toQuantity: string; toUnitId: string };

/** A stored conversion as the editor holds it. Pure. */
export function conversionDraft(conversion: FoodConversion): ConversionDraft {
  return {
    key: conversion.id,
    quantity: String(conversion.quantity),
    unitId: conversion.unitId,
    toQuantity: String(conversion.toQuantity),
    toUnitId: conversion.toUnitId,
  };
}

/** A blank row, ready to type into. Not pure — it mints a key. */
export function blankConversion(): ConversionDraft {
  return { key: crypto.randomUUID(), quantity: "", unitId: "", toQuantity: "", toUnitId: "" };
}

/** True when nothing has been typed into the row yet: it is dropped on save rather than rejected. Pure. */
export function isBlankConversion(row: ConversionDraft): boolean {
  return row.quantity.trim() === "" && row.unitId === "" && row.toQuantity.trim() === "" && row.toUnitId === "";
}

/**
 * Draft rows as they are written, or the first thing wrong with them. Blank
 * rows are dropped; a half-filled row, a non-positive amount, a row converting
 * a unit to itself and a repeated pair of units are all refused, the last
 * because the table's UNIQUE would refuse it anyway. Pure.
 */
export function parseConversions(rows: readonly ConversionDraft[]): { conversions: FoodConversionInput[]; error: string | null } {
  const conversions: FoodConversionInput[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (isBlankConversion(row)) continue;
    const quantity = Number(row.quantity.trim());
    const toQuantity = Number(row.toQuantity.trim());
    if (row.quantity.trim() === "" || row.toQuantity.trim() === "" || row.unitId === "" || row.toUnitId === "") {
      return { conversions: [], error: "Every conversion needs two amounts and two units." };
    }
    if (!Number.isFinite(quantity) || !Number.isFinite(toQuantity) || quantity <= 0 || toQuantity <= 0) {
      return { conversions: [], error: "Conversion amounts must be numbers above zero." };
    }
    if (row.unitId === row.toUnitId) return { conversions: [], error: "A conversion needs two different units." };
    const pair = `${row.unitId}>${row.toUnitId}`;
    if (seen.has(pair)) return { conversions: [], error: "There is more than one conversion between the same two units." };
    seen.add(pair);
    conversions.push({ unitId: row.unitId, quantity, toUnitId: row.toUnitId, toQuantity });
  }
  return { conversions, error: null };
}
