import { useEffect, useState } from "react";
import {
  type DraftIngredient,
  type FieldErrors,
  foodReference,
  type IngredientReview,
  isTextOnly,
  matchUnit,
  parsedRowPatch,
  parseRowFor,
  textOnlyPatch,
  unitReference,
} from "../../../domain/draft";
import { pendingCreations } from "../../../domain/ingredient";
import type { FoodRow, Unit } from "../../../domain/reference";
import { findOrCreateFood, listFoods } from "../../../server/fns/foods";
import { findOrCreateUnit } from "../../../server/fns/units";
import { FOOD_SEARCH_DEBOUNCE_MS, type IngredientFieldsProps } from "./IngredientFields";

export type UseIngredientEditRowOptions = {
  ingredient: DraftIngredient;
  path: string;
  label: string;
  units: readonly Unit[];
  errors: FieldErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onEnter?: () => void;
};

/** What the row's `IngredientFields` take, less what the row itself adds per width. */
export type IngredientEditRowFieldProps = Omit<IngredientFieldsProps, "showOriginalText" | "controls">;

export function useIngredientEditRow({ ingredient, path, label, units, errors, disabled, onPatch, onEnter }: UseIngredientEditRowOptions) {
  const [textOnly, setTextOnly] = useState(() => isTextOnly(ingredient));
  // Local text while a field is mid-edit; the committed value lives on the row.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitText, setUnitText] = useState(ingredient.unit?.name ?? "");
  const [foodText, setFoodText] = useState(ingredient.food?.name ?? "");
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);
  // The parse action: null until Parse is pressed, or once its
  // decision is applied or cancelled.
  const [parseReview, setParseReview] = useState<IngredientReview | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

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
    // A name nobody has yet becomes a reference with only a name; the repository find-or-creates it on save, so a row deleted before saving leaves nothing behind.
    onPatch({ food: foodReference({ name: text }) });
  };

  /** The mode toggle: to text only clears amount and food, so what the row shows is what it stores. */
  const setMode = (pressed: boolean) => {
    setTextOnly(pressed);
    if (pressed) {
      setUnitText("");
      setFoodText("");
      setQuantityDraft(null);
    }
    onPatch(textOnlyPatch(pressed));
  };

  // Only a text-only row with a raw line has anything for Parse to read.
  const canParse = textOnly && (ingredient.originalText ?? "").trim() !== "";

  /** Parse the row's `originalText` against the current vocabulary and open the review. */
  const startParse = async () => {
    setParseError(null);
    setParseBusy(true);
    try {
      const foods = await listFoods({ data: {} });
      setParseReview(parseRowFor(ingredient.originalText ?? "", { units, foods }, ingredient.id ?? "parse"));
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : "Could not parse this ingredient");
    } finally {
      setParseBusy(false);
    }
  };

  /** Dismiss the review: the row is left exactly as it was. */
  const cancelParse = () => {
    setParseReview(null);
    setParseError(null);
  };

  /** Create only what the review approved, then apply the patch — or, declined, apply nothing. */
  const confirmParse = async () => {
    if (parseReview === null) return;
    setParseBusy(true);
    setParseError(null);
    try {
      const pending = pendingCreations([parseReview]);
      const createdFoods = new Map<string, FoodRow>();
      for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
      const createdUnits = new Map<string, Unit>();
      for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
      const patch = parsedRowPatch(parseReview, createdFoods, createdUnits);
      if (patch !== null) {
        onPatch(patch);
        setTextOnly(false);
        setUnitText(patch.unit?.name ?? "");
        setFoodText(patch.food?.name ?? "");
      }
      setParseReview(null);
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : "Could not apply the parse");
    } finally {
      setParseBusy(false);
    }
  };

  const fieldProps: IngredientEditRowFieldProps = {
    ingredient,
    path,
    label,
    units,
    errors,
    disabled,
    textOnly,
    quantityDraft,
    unitText,
    foodText,
    foodRows,
    onEnter,
    parse: canParse
      ? {
          review: parseReview,
          busy: parseBusy,
          error: parseError,
          onStart: () => void startParse(),
          onChange: setParseReview,
          onCancel: cancelParse,
          onConfirm: () => void confirmParse(),
        }
      : undefined,
    onPatch,
    onQuantityText: setQuantityDraft,
    onUnitText: setUnitText,
    onUnitBlur: commitUnit,
    onFoodText: setFoodText,
    onFoodFocus: () => setFoodFocused(true),
    onFoodBlur: () => {
      setFoodFocused(false);
      commitFood();
    },
  };

  return { textOnly, setMode, fieldProps };
}
