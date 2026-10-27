import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SearchInput } from "@sixthshift/design-system/search-input";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import type { Food } from "../../db/models/food/repo";
import type { Unit } from "../../db/models/unit/repo";
import type { Aisle, FoodConversionInput, FoodPack, FoodPackInput } from "../../domain/reference";
import { picker } from "../../lib/ui/picker";
import { ConversionRows } from "./ConversionRows";
import { aliasesText, type ConversionDraft, conversionDraft, type PackDraft, packDraft, parseAliases, parseConversions, parsePacks } from "./foodEditDraft";
import { PackRows } from "./PackRows";

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
  /** Replaces the sizes the food is sold in wholesale (decisions.md row 184). */
  packs: FoodPackInput[];
};

export type FoodEditSheetContentProps = {
  food: Food;
  /** The sizes this food is sold in, for "Sold in". */
  packs?: readonly FoodPack[];
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

export function FoodEditSheetContent({
  food,
  packs = [],
  aisles,
  units = [],
  recipes = [],
  onSave,
  onCancel,
  onCreateAisle,
  busy = false,
}: FoodEditSheetContentProps) {
  const [name, setName] = useState(food.name);
  const [pluralName, setPluralName] = useState(food.pluralName ?? "");
  const [aliases, setAliases] = useState(() => aliasesText(food.aliases));
  const [skipShopping, setSkipShopping] = useState(food.skipShopping);
  const [aisleId, setAisleId] = useState(food.aisleId);
  const [conversions, setConversions] = useState<ConversionDraft[]>(() => food.conversions.map(conversionDraft));
  const [sizes, setSizes] = useState<PackDraft[]>(() => packs.map(packDraft));
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
    const parsedSizes = parsePacks(sizes);
    if (parsedSizes.error) {
      setError(parsedSizes.error);
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
      packs: parsedSizes.packs,
    });
  };

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">{sheetTitle(food)}</h2>
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
            <SearchInput
              value={aisleText}
              disabled={busy}
              aria-label="Aisle"
              placeholder="None"
              onValueChange={(text) => {
                setAisleText(text);
                if (text.trim() === "") setAisleId(null);
              }}
              {...picker({
                options: aisles.map((aisle) => ({ value: aisle.id, label: aisle.name })),
                text: aisleText,
                label: "Aisle suggestions",
                onSelect: (option) => {
                  setAisleId(option.value);
                  setAisleText(option.label);
                },
                onCreate: (text) => {
                  void onCreateAisle(text).then((aisle) => {
                    setAisleId(aisle.id);
                    setAisleText(aisle.name);
                  });
                },
              })}
            />
          </FormField>
          {recipes.length > 0 && (
            <FormField label="Made by a recipe" description="This food is the result of another recipe; leave it blank for an ordinary ingredient.">
              <SearchInput
                value={recipeText}
                disabled={busy}
                aria-label="Made by a recipe"
                placeholder="None"
                onValueChange={(text) => {
                  setRecipeText(text);
                  if (text.trim() === "") setRecipeId(null);
                }}
                {...picker({
                  options: recipes.map((recipe) => ({ value: recipe.id, label: recipe.name })),
                  text: recipeText,
                  label: "Recipe suggestions",
                  onSelect: (option) => {
                    setRecipeId(option.value);
                    setRecipeText(option.label);
                  },
                })}
              />
            </FormField>
          )}
          <FormField label="Aliases" description="One per line.">
            <Textarea value={aliases} disabled={busy} onChange={(event) => setAliases(event.target.value)} />
          </FormField>
          <div className="flex flex-col gap-1">
            <Checkbox label="On hand" checked={skipShopping} disabled={busy} onCheckedChange={setSkipShopping} />
            <Muted as="p" className="ml-6 text-sm">
              Always in the cupboard: it goes on the shopping list already ticked.
            </Muted>
          </div>
          <PackRows packs={sizes} units={units} busy={busy} onChange={setSizes} />
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

/** "New food" for a food not saved yet (an empty id), "Edit aioli" otherwise. */
function sheetTitle(food: Food): string {
  return food.id === "" ? "New food" : `Edit ${food.name}`;
}

export function FoodEditSheet({ open, ...props }: FoodEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label={sheetTitle(props.food)}>
      <FoodEditSheetContent {...props} />
    </Sheet>
  );
}
