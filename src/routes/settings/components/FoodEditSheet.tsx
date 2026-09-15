import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import { Combobox } from "../../../components/ui/Combobox";
import type { Food } from "../../../db/models/food/repo";
import type { Unit } from "../../../db/models/unit/repo";
import type { Aisle, FoodConversionInput } from "../../../domain/reference";
import { ConversionRows } from "./ConversionRows";
import { aliasesText, type ConversionDraft, conversionDraft, parseAliases, parseConversions } from "./foodEditDraft";

/** A recipe as the "Made by a recipe" Combobox offers it. */
export type RecipeOption = { id: string; name: string };

/** What a save hands back: the repository's flat patch shape. */
export type FoodPatch = {
  id: string;
  name: string;
  pluralName: string | null;
  aliases: string[];
  aisleId: string | null;
  /** The recipe this food is made by, or null for an ordinary food. */
  recipeId: string | null;
  skipShopping: boolean;
  /** Replaces the food's conversions wholesale. */
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
          <ConversionRows conversions={conversions} units={units} busy={busy} onChange={setConversions} />
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
