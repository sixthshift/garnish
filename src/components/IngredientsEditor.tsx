// The ingredient rows of one component: quantity, unit, food, note and the
// fixed flag, in a ReorderList, plus a "move to" that sends a row to the end
// of another component. The parent owns the draft; every change goes through
// a pure helper and comes back through `onChange` as a new `RecipeDraft`.
//
// References are resolved on save, not while typing. Picking a suggestion puts
// the existing unit or food object on the row; typing a name nobody has yet
// puts a reference with a fresh client id and just the name (defaults for the
// rest), and the recipe repository's find-or-create matches it by name or
// inserts it when the recipe is written. So `findOrCreateFood` is never called
// from here: the food is created on save, once, alongside the recipe, and a
// row that is deleted before saving leaves nothing behind. Suggestions come
// from `listFoods({ q })`, debounced, while the food input has focus; units
// are filtered from the list the page already loaded.
//
// A row is either structured (quantity, unit, food, note, fixed) or text only
// (one free line in `originalText`, the shape a not-yet-parsed line has and
// the closest thing here to Mealie's disable-amount setting, which shows one
// plain line per ingredient). A row opens in the mode its data implies (no
// food and some originalText is text only) and a toggle switches it; the
// switch to text only clears amount and food, so what the row shows is exactly
// what it stores.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { Toggle } from "@sixthshift/design-system/toggle";
import { useEffect, useState } from "react";
import type { Food as FoodRow } from "../db/foods";
import type { Food, Unit } from "../domain/recipe";
import { randomUuid } from "../lib/ids";
import { listFoods } from "../server/foods";
import { componentLabel } from "./ComponentsEditor";
import type { DraftIngredient, FieldErrors, RecipeDraft } from "./RecipeForm";
import { Combobox, type ComboboxOption } from "./ui/Combobox";
import { ReorderList } from "./ui/ReorderList";

/** How long the food input waits after the last keystroke before querying. */
export const FOOD_SEARCH_DEBOUNCE_MS = 200;

// --- Pure helpers -----------------------------------------------------------

const VULGAR: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
};

/**
 * A quantity field's text as a number, or null for "no amount". Accepts
 * decimals ("0.5", "2"), fractions ("1/2"), mixed numbers ("1 1/2", "1½") and
 * the vulgar fraction glyphs the recipe page prints ("½"). Blank, unparseable
 * text and division by zero are null; the sign is kept so zod can reject a
 * negative. Pure.
 */
export function parseQuantity(text: string): number | null {
  let s = text.trim().replace(/\s+/g, " ");
  if (s === "") return null;
  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1).trim();
  }
  // Trailing glyph: "1½" or "½".
  const last = s.slice(-1);
  if (last in VULGAR) {
    const whole = s.slice(0, -1).trim();
    if (whole === "") return sign * VULGAR[last]!;
    if (!/^\d+$/.test(whole)) return null;
    return sign * (Number(whole) + VULGAR[last]!);
  }
  const mixed = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, numerator, denominator] = mixed;
    if (Number(denominator) === 0) return null;
    return sign * ((whole ? Number(whole) : 0) + Number(numerator) / Number(denominator));
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return sign * Number(s);
}

/** The text a quantity shows when not being edited: "" for null, else the plain number. Pure. */
export function quantityText(quantity: number | null | undefined): string {
  return quantity === null || quantity === undefined ? "" : String(quantity);
}

/** A blank structured row with a fresh id, so it has a stable key before it is saved. */
export function newIngredient(): DraftIngredient {
  return { id: randomUuid(), quantity: null, unit: null, food: null, note: "", originalText: "", fixed: false };
}

/** A row is text only when it has no food and some original text. Pure. */
export function isTextOnly(ingredient: DraftIngredient): boolean {
  return !ingredient.food && (ingredient.originalText ?? "").trim() !== "";
}

/**
 * A food reference for the document from a `listFoods` row (its aisle is sent
 * as null; the repository keeps the stored row untouched) or, given only a
 * name, a new reference with a client id the repository will replace. Pure
 * apart from the random id.
 */
export function foodReference(source: FoodRow | { name: string }): Food {
  if ("id" in source) {
    return {
      id: source.id,
      name: source.name,
      pluralName: source.pluralName,
      aliases: source.aliases,
      aisle: null,
      recipeId: source.recipeId,
      skipShopping: source.skipShopping,
    };
  }
  return { id: randomUuid(), name: source.name.trim(), pluralName: null, aliases: [], aisle: null, recipeId: null, skipShopping: false };
}

/** A new unit reference by name, defaults for the rest; the repository find-or-creates it on save. Pure apart from the random id. */
export function unitReference(name: string): Unit {
  return { id: randomUuid(), name: name.trim(), pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null };
}

/** The unit whose name, plural or abbreviation equals `text`, ignoring case. Pure. */
export function matchUnit(units: readonly Unit[], text: string): Unit | undefined {
  const key = text.trim().toLowerCase();
  if (key === "") return undefined;
  return (
    units.find((unit) => unit.name.toLowerCase() === key) ??
    units.find((unit) => unit.abbreviation.trim().toLowerCase() === key) ??
    units.find((unit) => (unit.pluralName ?? "").trim().toLowerCase() === key)
  );
}

/** Units whose name, plural or abbreviation contains `text` (case-insensitive); all of them for blank text. Pure. */
export function filterUnits(units: readonly Unit[], text: string): Unit[] {
  const key = text.trim().toLowerCase();
  if (key === "") return units.slice();
  return units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(key) ||
      unit.abbreviation.toLowerCase().includes(key) ||
      (unit.pluralName ?? "").toLowerCase().includes(key),
  );
}

function withIngredients(draft: RecipeDraft, ci: number, ingredients: DraftIngredient[]): RecipeDraft {
  return { ...draft, components: draft.components.map((component, i) => (i === ci ? { ...component, ingredients } : component)) };
}

function inRange(draft: RecipeDraft, ci: number, ii?: number): boolean {
  const component = draft.components[ci];
  if (ci < 0 || !component) return false;
  return ii === undefined || (ii >= 0 && ii < component.ingredients.length);
}

/** The draft with a blank row appended to component `ci`. An out-of-range `ci` returns a copy unchanged. Pure apart from the row's id. */
export function addIngredient(draft: RecipeDraft, ci: number): RecipeDraft {
  if (!inRange(draft, ci)) return { ...draft, components: draft.components.slice() };
  return withIngredients(draft, ci, [...draft.components[ci]!.ingredients, newIngredient()]);
}

/** The draft with `patch` merged into row `ii` of component `ci`. Out-of-range indices return a copy unchanged. Pure. */
export function updateIngredient(draft: RecipeDraft, ci: number, ii: number, patch: Partial<DraftIngredient>): RecipeDraft {
  if (!inRange(draft, ci, ii)) return { ...draft, components: draft.components.slice() };
  const ingredients = draft.components[ci]!.ingredients.map((row, i) => (i === ii ? { ...row, ...patch } : row));
  return withIngredients(draft, ci, ingredients);
}

/** The draft without row `ii` of component `ci`. Out-of-range indices return a copy unchanged. Pure. */
export function removeIngredient(draft: RecipeDraft, ci: number, ii: number): RecipeDraft {
  if (!inRange(draft, ci, ii)) return { ...draft, components: draft.components.slice() };
  return withIngredients(
    draft,
    ci,
    draft.components[ci]!.ingredients.filter((_, i) => i !== ii),
  );
}

/**
 * The draft with row `ii` of component `fromCi` appended to component `toCi`.
 * The same component, or an out-of-range index, returns a copy unchanged. Pure.
 */
export function moveIngredient(draft: RecipeDraft, fromCi: number, ii: number, toCi: number): RecipeDraft {
  if (fromCi === toCi || !inRange(draft, fromCi, ii) || !inRange(draft, toCi)) return { ...draft, components: draft.components.slice() };
  const row = draft.components[fromCi]!.ingredients[ii]!;
  return {
    ...draft,
    components: draft.components.map((component, i) => {
      if (i === fromCi) return { ...component, ingredients: component.ingredients.filter((_, j) => j !== ii) };
      if (i === toCi) return { ...component, ingredients: [...component.ingredients, row] };
      return component;
    }),
  };
}

/** The row patch that switches modes: to text only clears amount and food; back to structured clears the raw line. Pure. */
export function textOnlyPatch(textOnly: boolean): Partial<DraftIngredient> {
  return textOnly ? { quantity: null, unit: null, food: null, fixed: false } : { originalText: "" };
}

// --- Component --------------------------------------------------------------

export type IngredientsEditorProps = {
  draft: RecipeDraft;
  /** Index of the component whose rows these are. */
  ci: number;
  units: readonly Unit[];
  onChange: (draft: RecipeDraft) => void;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function IngredientsEditor({ draft, ci, units, onChange, errors = {}, disabled }: IngredientsEditorProps) {
  const component = draft.components[ci];
  if (!component) return null;
  const { ingredients } = component;

  return (
    <div className="flex flex-col gap-2" data-ingredients={ci}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          Ingredients
        </Muted>
        <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addIngredient(draft, ci))}>
          Add ingredient
        </Button>
      </div>
      {ingredients.length === 0 ? (
        <Muted as="p" className="text-sm">
          No ingredients yet
        </Muted>
      ) : (
        <ReorderList
          items={ingredients}
          keyOf={(row) => row.id ?? "unsaved"}
          itemName="ingredient"
          onReorder={(next) => onChange(withIngredients(draft, ci, next))}
          onRemove={(_, ii) => onChange(removeIngredient(draft, ci, ii))}
          renderItem={(row, ii) => (
            <IngredientRow
              key={row.id ?? ii}
              ingredient={row}
              ci={ci}
              ii={ii}
              units={units}
              components={draft.components.map((c, i) => ({ value: String(i), label: componentLabel(c, i) })).filter((_, i) => i !== ci)}
              errors={errors}
              disabled={disabled}
              onPatch={(patch) => onChange(updateIngredient(draft, ci, ii, patch))}
              onMove={(toCi) => onChange(moveIngredient(draft, ci, ii, toCi))}
            />
          )}
        />
      )}
    </div>
  );
}

type IngredientRowProps = {
  ingredient: DraftIngredient;
  ci: number;
  ii: number;
  units: readonly Unit[];
  /** The other components, as "move to" options (value is the component index). */
  components: ComboboxOption[];
  errors: FieldErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onMove: (toCi: number) => void;
};

function IngredientRow({ ingredient, ci, ii, units, components, errors, disabled, onPatch, onMove }: IngredientRowProps) {
  const path = `components.${ci}.ingredients.${ii}`;
  const label = `Ingredient ${ii + 1}`;
  const [textOnly, setTextOnly] = useState(() => isTextOnly(ingredient));
  // Local text while a field is mid-edit; the committed value lives on the row.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitText, setUnitText] = useState(ingredient.unit?.name ?? "");
  const [foodText, setFoodText] = useState(ingredient.food?.name ?? "");
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);

  // Query foods while the input has focus, a beat after the last keystroke.
  useEffect(() => {
    const q = foodText.trim();
    if (!foodFocused || q === "") {
      setFoodRows([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      listFoods({ data: { q } })
        .then((rows) => {
          if (!stale) setFoodRows(rows);
        })
        .catch(() => {
          if (!stale) setFoodRows([]);
        });
    }, FOOD_SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [foodText, foodFocused]);

  const quantityError = errors[`${path}.quantity`];

  const commitUnit = () => {
    const text = unitText.trim();
    if (text === "") {
      if (ingredient.unit) onPatch({ unit: null });
      return;
    }
    const match = matchUnit(units, text);
    if (match) {
      if (ingredient.unit?.id !== match.id) onPatch({ unit: match });
      setUnitText(match.name);
      return;
    }
    if (ingredient.unit && ingredient.unit.name.toLowerCase() === text.toLowerCase()) return;
    onPatch({ unit: unitReference(text) });
  };

  const commitFood = () => {
    const text = foodText.trim();
    if (text === "") {
      if (ingredient.food) onPatch({ food: null });
      return;
    }
    const match = foodRows.find((row) => row.name.toLowerCase() === text.toLowerCase());
    if (match) {
      if (ingredient.food?.id !== match.id) onPatch({ food: foodReference(match) });
      setFoodText(match.name);
      return;
    }
    if (ingredient.food && ingredient.food.name.toLowerCase() === text.toLowerCase()) return;
    onPatch({ food: foodReference({ name: text }) });
  };

  const modeToggle = (
    <Toggle
      type="button"
      variant="ghost"
      intent="neutral"
      size="sm"
      aria-label={`${label} text only`}
      pressed={textOnly}
      disabled={disabled}
      onPressedChange={(pressed) => {
        setTextOnly(pressed);
        if (pressed) {
          setUnitText("");
          setFoodText("");
          setQuantityDraft(null);
        }
        onPatch(textOnlyPatch(pressed));
      }}
    >
      Text
    </Toggle>
  );

  const moveTo =
    components.length > 0 ? (
      <Select
        aria-label={`Move ${label.toLowerCase()} to component`}
        options={components}
        placeholder="Move to…"
        disabled={disabled}
        className="w-36"
        onValueChange={(value) => onMove(Number(value))}
      />
    ) : null;

  if (textOnly) {
    return (
      <div className="flex flex-col gap-2" data-ingredient={ii} data-mode="text">
        <Input
          name={`${path}.originalText`}
          aria-label={`${label} text`}
          placeholder="e.g. a pinch of salt"
          autoComplete="off"
          value={ingredient.originalText ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({ originalText: event.target.value })}
        />
        <div className="flex flex-wrap items-center gap-2">
          {modeToggle}
          {moveTo}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-ingredient={ii} data-mode="structured">
      <div className="flex flex-wrap gap-2">
        <Input
          name={`${path}.quantity`}
          aria-label={`${label} quantity`}
          aria-invalid={quantityError !== undefined || undefined}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Qty"
          className="w-20"
          value={quantityDraft ?? quantityText(ingredient.quantity)}
          disabled={disabled}
          onChange={(event) => {
            setQuantityDraft(event.target.value);
            onPatch({ quantity: parseQuantity(event.target.value) });
          }}
          onBlur={() => setQuantityDraft(null)}
        />
        <Combobox
          name={`${path}.unit`}
          aria-label={`${label} unit`}
          placeholder="Unit"
          className="w-28 grow"
          value={unitText}
          options={filterUnits(units, unitText).map((unit) => ({ value: unit.id, label: unit.name, hint: unit.abbreviation || undefined }))}
          disabled={disabled}
          onChange={setUnitText}
          onSelect={(option) => {
            const unit = units.find((u) => u.id === option.value);
            if (!unit) return;
            setUnitText(unit.name);
            onPatch({ unit });
          }}
          onCreate={(text) => {
            setUnitText(text);
            onPatch({ unit: unitReference(text) });
          }}
          onBlur={commitUnit}
        />
        <Combobox
          name={`${path}.food`}
          aria-label={`${label} food`}
          placeholder="Food"
          className="min-w-40 grow-[2]"
          value={foodText}
          options={foodRows.map((row) => ({ value: row.id, label: row.name }))}
          disabled={disabled}
          onChange={setFoodText}
          onFocus={() => setFoodFocused(true)}
          onSelect={(option) => {
            const row = foodRows.find((r) => r.id === option.value);
            if (!row) return;
            setFoodText(row.name);
            onPatch({ food: foodReference(row) });
          }}
          onCreate={(text) => {
            setFoodText(text);
            onPatch({ food: foodReference({ name: text }) });
          }}
          onBlur={() => {
            setFoodFocused(false);
            commitFood();
          }}
        />
      </div>
      {quantityError !== undefined && (
        <p className="text-sm text-fg-danger" role="alert">
          {quantityError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name={`${path}.note`}
          aria-label={`${label} note`}
          placeholder="Note, e.g. sifted"
          autoComplete="off"
          className="min-w-40 grow"
          value={ingredient.note ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({ note: event.target.value })}
        />
        <Checkbox
          name={`${path}.fixed`}
          label="Fixed"
          aria-label={`${label} fixed`}
          checked={ingredient.fixed ?? false}
          disabled={disabled}
          onCheckedChange={(fixed) => onPatch({ fixed })}
        />
        {modeToggle}
        {moveTo}
      </div>
    </div>
  );
}
