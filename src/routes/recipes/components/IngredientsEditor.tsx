// The ingredient rows of one part: quantity, unit, food, note and the
// fixed flag, in a ReorderList, plus a "move to" that sends a row to the end
// of another part and a drag handle that does the same by hand: every part's
// list shares one drag group, so a row dropped on another part's list lands
// where it was released (M13.3). The parent owns the
// draft; every change goes through a pure helper and comes back through
// `onChange` as a new `RecipeDraft`.
//
// References are resolved on save, not while typing. Picking a suggestion puts
// the existing unit or food object on the row; typing a name nobody has yet
// puts a reference with a fresh client id and just the name (defaults for the
// rest), and the recipe repository's find-or-create matches it by name or
// inserts it when the recipe is written. So typing into a row never calls
// `findOrCreateFood`: the food is created on save, once, alongside the recipe,
// and a row that is deleted before saving leaves nothing behind. Suggestions
// come from `listFoods({ q })`, debounced, while the food input has focus;
// units are filtered from the list the page already loaded.
//
// Bulk add is the one path that does create vocabulary up front (M17.5). A
// paste is parsed by `parseIngredient` and reviewed line by line in the sheet;
// Confirm calls `findOrCreateFood`/`findOrCreateUnit` for the names the
// reviewer approved and nothing else, then appends the rows. A line whose food
// was declined lands as a text-only row holding the pasted text, exactly as
// every bulk-added line used to.
//
// Entry is text first (M27.2, decisions.md row 63). An empty list renders
// `BulkInlineAdd` — a textarea, one ingredient per line — instead of an empty
// message, and Add runs the same review inline, in place of the textarea, that
// the sheet runs in a sheet: one `ingredientReview` definition, one
// `confirmReviewedIngredients`. Once the part has rows the textarea goes and
// "Bulk add" in the header is the way to add more.
//
// A row is either structured (quantity, unit, food, note, fixed) or text only
// (one free line in `originalText`, the shape a not-yet-parsed line has and
// the closest thing here to Mealie's disable-amount setting, which shows one
// plain line per ingredient). A row opens in the mode its data implies (no
// food and some originalText is text only) and a toggle switches it; the
// switch to text only clears amount and food, so what the row shows is exactly
// what it stores.
//
// Two widths (M13.2). Below `md` a row is one line — the formatted ingredient,
// or the raw line for a text-only row — with a chevron; tapping it opens a
// `sheet` holding the same fields plus the row's `originalText`, read only, so
// a parsed line can be checked against what it came from. From `md` up the
// fields sit inline and the sheet is never opened; a parsed row's
// `originalText`, when it has one, prints in grey above those inline fields
// instead (M13.6), the same check without a tap. Both render `IngredientFields`
// against the same row and the same `onPatch`, so a sheet edit lands in the
// draft exactly as an inline one does; the sheet's Done only closes it.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Input } from "@sixthshift/design-system/input";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Toggle } from "@sixthshift/design-system/toggle";
import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { BulkAddSheet, BulkInlineAdd, type BulkReview } from "../../../components/ui/BulkAddSheet";
import { Combobox } from "../../../components/ui/Combobox";
import { Menu } from "../../../components/ui/Menu";
import { ReorderList } from "../../../components/ui/ReorderList";
import {
  addIngredient,
  addReviewedIngredients,
  type DraftIngredient,
  type FieldErrors,
  filterUnits,
  foodReference,
  type IngredientReview,
  ingredientSummary,
  isTextOnly,
  matchUnit,
  moveIngredient,
  moveIngredientTo,
  needsParseAll,
  parsedRowPatch,
  parseQuantity,
  parseRowFor,
  quantityText,
  type RecipeDraft,
  removeIngredient,
  textOnlyPatch,
  unitReference,
  updateIngredient,
  withIngredients,
} from "../../../domain/draft";
import { pendingCreations, reviewRows, rowCommit } from "../../../domain/ingredient";
import type { Food, FoodRow, Unit } from "../../../domain/reference";
import { focusNamed, rowEnter, rowFieldName } from "../../../lib/rowKeys";
import type { ComboboxOption } from "../../../lib/ui/combobox";
import { findOrCreateFood, listFoods } from "../../../server/fns/foods";
import { findOrCreateUnit } from "../../../server/fns/units";
import { IngredientReviewRow } from "./IngredientReviewRow";
import { ParseAllSheet } from "./ParseAllSheet";
import { partLabel } from "./PartsEditor";

/** How long the food input waits after the last keystroke before querying. */
export const FOOD_SEARCH_DEBOUNCE_MS = 200;

// --- Pure helpers -----------------------------------------------------------

/**
 * Confirm a set of reviewed lines: create only the foods and units the
 * reviewer approved, then return the draft with one row appended per line.
 * The one path that creates vocabulary up front, shared by the bulk-add sheet
 * and the empty list's inline entry (M27.2), so both land rows identically —
 * a line whose food was declined lands text-only either way.
 */
export async function confirmReviewedIngredients(rows: readonly IngredientReview[], draft: RecipeDraft, pi: number): Promise<RecipeDraft> {
  const pending = pendingCreations(rows);
  const createdFoods = new Map<string, FoodRow>();
  for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
  const createdUnits = new Map<string, Unit>();
  for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
  return addReviewedIngredients(draft, pi, rows.map(rowCommit), createdFoods, createdUnits);
}

/**
 * The review stage for a pasted block of ingredient lines: how a line becomes
 * a review row, how that row renders, and what Confirm does with it. One
 * definition, handed to both the bulk-add sheet and the inline entry panel, so
 * the two cannot drift.
 */
export function ingredientReview(args: {
  units: readonly Unit[];
  foods: readonly FoodRow[];
  disabled?: boolean;
  confirm: (rows: IngredientReview[]) => void | Promise<void>;
}): BulkReview<IngredientReview> {
  const { units, foods, disabled, confirm } = args;
  return {
    rows: (lines) => reviewRows(lines, { units, foods }),
    keyOf: (row) => row.key,
    confirm,
    renderRow: (row, index, onRowChange) => (
      <IngredientReviewRow
        row={row}
        label={`Line ${index + 1}`}
        unitMatches={(text) => filterUnits(units, text)}
        searchFoods={(q) => listFoods({ data: { q } })}
        disabled={disabled}
        onChange={onRowChange}
      />
    ),
  };
}

// --- Component --------------------------------------------------------------

/** Every part's ingredient list shares this drag group, so a row can be dragged from one to another. */
export const INGREDIENT_DRAG_GROUP = "recipe-ingredients";

export type IngredientsEditorProps = {
  draft: RecipeDraft;
  /** Index of the part whose rows these are. */
  pi: number;
  units: readonly Unit[];
  onChange: (draft: RecipeDraft) => void;
  errors?: FieldErrors;
  disabled?: boolean;
};

export function IngredientsEditor({ draft, pi, units, onChange, errors = {}, disabled }: IngredientsEditorProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [parseAllOpen, setParseAllOpen] = useState(false);
  // The whole food vocabulary, loaded once the bulk sheet opens or the list is
  // empty and showing its inline entry: parsing a pasted block needs every
  // food, not the query-by-query slice a row's combobox asks for.
  const [vocabularyFoods, setVocabularyFoods] = useState<FoodRow[]>([]);
  const part = draft.parts[pi];
  const isEmpty = (part?.ingredients.length ?? 0) === 0;

  useEffect(() => {
    if (!bulkOpen && !isEmpty) return;
    let stale = false;
    listFoods({ data: {} })
      .then((rows) => {
        if (!stale) setVocabularyFoods(rows);
      })
      .catch(() => {
        if (!stale) setVocabularyFoods([]);
      });
    return () => {
      stale = true;
    };
  }, [bulkOpen, isEmpty]);

  /** Create only what the reviewer approved, then append the rows. */
  const confirmBulk = async (rows: IngredientReview[]) => {
    onChange(await confirmReviewedIngredients(rows, draft, pi));
  };

  const review = ingredientReview({ units, foods: vocabularyFoods, disabled, confirm: confirmBulk });

  if (!part) return null;
  const { ingredients } = part;
  const path = `parts.${pi}.ingredients`;

  /**
   * Enter on row `ii`'s last field: append and focus from the last row, move
   * to the next row's first field from any earlier one (decisions.md row 55).
   * The new row's first field is `quantity` on a structured row and `text` on
   * a text-only one; a blank row is always structured.
   */
  const enterOnRow = (ii: number) => {
    const action = rowEnter(ii, ingredients.length);
    if (action === "ignore") return;
    if (action === "append") {
      onChange(addIngredient(draft, pi));
      focusNamed(rowFieldName(path, ingredients.length, "quantity"));
      return;
    }
    const next = ingredients[ii + 1]!;
    focusNamed(rowFieldName(path, ii + 1, isTextOnly(next) ? "originalText" : "quantity"));
  };

  return (
    <div className="flex flex-col gap-2" data-ingredients={pi}>
      <div className="flex items-center justify-between gap-3">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          Ingredients
        </Muted>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => setBulkOpen(true)}>
            Bulk add
          </Button>
          <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={disabled} onClick={() => onChange(addIngredient(draft, pi))}>
            Add ingredient
          </Button>
        </div>
      </div>
      {needsParseAll(part) && (
        <Message intent="info" title="Nothing here is parsed" data-testid="parse-all-banner">
          <div className="flex flex-col gap-2">
            <span>These rows are plain text, so they will not scale, merge or match a food filter.</span>
            <div>
              <Button type="button" variant="outline" intent="brand" size="sm" disabled={disabled} onClick={() => setParseAllOpen(true)}>
                Parse all
              </Button>
            </div>
          </div>
        </Message>
      )}
      <ParseAllSheet open={parseAllOpen} onOpenChange={setParseAllOpen} draft={draft} pi={pi} units={units} disabled={disabled} onChange={onChange} />
      <BulkAddSheet<IngredientReview> open={bulkOpen} onOpenChange={setBulkOpen} itemName="ingredient" disabled={disabled} review={review} />
      <EmptyBoundary
        isEmpty={ingredients.length === 0}
        fallback={<BulkInlineAdd<IngredientReview> itemName="ingredient" review={review} disabled={disabled} />}
      >
        <ReorderList
          items={ingredients}
          keyOf={(row) => row.id ?? "unsaved"}
          itemName="ingredient"
          group={INGREDIENT_DRAG_GROUP}
          listKey={String(pi)}
          onMoveOut={(_, ii, toPi, toIndex) => onChange(moveIngredientTo(draft, pi, ii, Number(toPi), toIndex))}
          onReorder={(next) => onChange(withIngredients(draft, pi, next))}
          onRemove={(_, ii) => onChange(removeIngredient(draft, pi, ii))}
          renderItem={(row, ii) => (
            <IngredientRow
              key={row.id ?? ii}
              ingredient={row}
              pi={pi}
              ii={ii}
              units={units}
              onEnter={() => enterOnRow(ii)}
              parts={draft.parts.map((c, i) => ({ value: String(i), label: partLabel(c, i) })).filter((_, i) => i !== pi)}
              errors={errors}
              disabled={disabled}
              onPatch={(patch) => onChange(updateIngredient(draft, pi, ii, patch))}
              onMove={(toPi) => onChange(moveIngredient(draft, pi, ii, toPi))}
            />
          )}
        />
      </EmptyBoundary>
    </div>
  );
}

// --- Phone rows -------------------------------------------------------------

/** What a row with nothing in it yet shows on its summary line. */
export const EMPTY_INGREDIENT_SUMMARY = "New ingredient";

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <title>Open</title>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/**
 * The fields of one ingredient row. Rendered inline from `md` up and inside
 * the phone sheet below it, so both widths edit the same row through the same
 * `onPatch`. No state of its own: the row owns the mid-edit text and the food
 * suggestions, which keeps this a plain function a test can call directly.
 */
export type IngredientFieldsProps = {
  ingredient: DraftIngredient;
  /** Field name prefix, e.g. "parts.0.ingredients.1". */
  path: string;
  /** Label prefix for every control, e.g. "Ingredient 2". */
  label: string;
  units: readonly Unit[];
  errors: FieldErrors;
  disabled?: boolean;
  /** True for a text-only row: one free line instead of the amount fields. */
  textOnly: boolean;
  /** The quantity text while it is being typed; null falls back to the committed value. */
  quantityDraft: string | null;
  unitText: string;
  foodText: string;
  /** Food suggestions the row has fetched. */
  foodRows: readonly FoodRow[];
  /** The mode toggle and "move to" select, built by the row. */
  controls?: ReactNode;
  /** Adds the read-only `originalText` line under the fields; the phone sheet sets it. */
  showOriginalText?: boolean;
  /** Adds the grey `originalText` line above a parsed row's fields; the inline (`md` and up) row sets it (M13.6). */
  originalTextAbove?: boolean;
  /**
   * The "Parse" action for a text-only row (M17.6), present only when the
   * row has something to parse. `review` is the row mid-decision — chips to
   * confirm or decline, same as bulk add — or null before Parse is pressed
   * and after it is applied or cancelled.
   */
  /**
   * Enter on the row's last field (M21.4): appends a row and focuses it from
   * the last row, moves to the next row from any earlier one. Absent where
   * there is no list to append to.
   */
  onEnter?: () => void;
  parse?: {
    review: IngredientReview | null;
    busy: boolean;
    error: string | null;
    onStart: () => void;
    onChange: (row: IngredientReview) => void;
    onCancel: () => void;
    onConfirm: () => void;
  };
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onQuantityText: (text: string | null) => void;
  onUnitText: (text: string) => void;
  onUnitBlur: () => void;
  onFoodText: (text: string) => void;
  onFoodFocus: () => void;
  onFoodBlur: () => void;
};

/**
 * The "Parse" action itself (M17.6): a trigger — a menu item inline, a plain
 * button in the phone sheet, the two placements the task asks for — that
 * becomes the same review chips bulk add shows once pressed, with Cancel
 * (nothing changes) and Apply (commits the decision) alongside. No state of
 * its own; `parse` carries it all, so this stays a plain function like
 * `IngredientFields` itself.
 */
function parseAction(
  parse: NonNullable<IngredientFieldsProps["parse"]>,
  label: string,
  units: readonly Unit[],
  disabled: boolean | undefined,
  variant: "menu" | "button"
): ReactNode {
  const busy = parse.busy || disabled === true;

  if (parse.review !== null) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border-normal p-3" data-parse-review="">
        <IngredientReviewRow
          row={parse.review}
          label={`${label} parse`}
          unitMatches={(text) => filterUnits(units, text)}
          searchFoods={(q) => listFoods({ data: { q } })}
          disabled={busy}
          onChange={parse.onChange}
        />
        {parse.error !== null && (
          <p className="text-sm text-fg-danger" role="alert">
            {parse.error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" intent="neutral" size="sm" aria-label={`${label} parse cancel`} disabled={busy} onClick={parse.onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="solid" intent="brand" size="sm" aria-label={`${label} parse apply`} disabled={busy} onClick={parse.onConfirm}>
            Apply parse
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "button") {
    return (
      <Button type="button" variant="outline" intent="neutral" size="sm" aria-label={`${label} parse`} disabled={busy} onClick={parse.onStart}>
        Parse
      </Button>
    );
  }

  return (
    <Menu label={`${label} actions`} iconOnly>
      <Menu.Item onSelect={parse.onStart} disabled={busy}>
        Parse
      </Menu.Item>
    </Menu>
  );
}

export function IngredientFields(props: IngredientFieldsProps) {
  const {
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
    controls,
    showOriginalText,
    originalTextAbove,
    parse,
    onEnter,
  } = props;
  // Enter in a single-line field submits the form by default; the list's own
  // meaning for it has to say so explicitly (decisions.md row 55).
  const enterKey =
    onEnter === undefined
      ? undefined
      : (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          onEnter();
        };
  const quantityError = errors[`${path}.quantity`];

  const originalText = (ingredient.originalText ?? "").trim();
  const originalLine =
    showOriginalText === true && !textOnly ? (
      <div className="flex flex-col gap-0.5" data-original-text="">
        <Muted as="span" className="text-xs font-medium uppercase tracking-wide">
          Original text
        </Muted>
        <p className="text-sm text-fg-subtle">{originalText === "" ? "—" : originalText}</p>
      </div>
    ) : null;
  const originalTextLine =
    originalTextAbove === true && !textOnly && originalText !== "" ? (
      <p className="text-sm text-fg-subtle" data-original-text-above="">
        {originalText}
      </p>
    ) : null;

  if (textOnly) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          name={`${path}.originalText`}
          aria-label={`${label} text`}
          placeholder="e.g. a pinch of salt"
          autoComplete="off"
          value={ingredient.originalText ?? ""}
          disabled={disabled}
          onKeyDown={enterKey}
          onChange={(event) => props.onPatch({ originalText: event.target.value })}
        />
        {controls !== undefined && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        {parse !== undefined && parseAction(parse, label, units, disabled, showOriginalText === true ? "button" : "menu")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {originalTextLine}
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
            props.onQuantityText(event.target.value);
            props.onPatch({ quantity: parseQuantity(event.target.value) });
          }}
          onBlur={() => props.onQuantityText(null)}
        />
        <Combobox
          name={`${path}.unit`}
          aria-label={`${label} unit`}
          placeholder="Unit"
          className="w-28 grow"
          value={unitText}
          options={filterUnits(units, unitText).map((unit) => ({ value: unit.id, label: unit.name, hint: unit.abbreviation || undefined }))}
          disabled={disabled}
          onChange={props.onUnitText}
          onSelect={(option) => {
            const unit = units.find((u) => u.id === option.value);
            if (!unit) return;
            props.onUnitText(unit.name);
            props.onPatch({ unit });
          }}
          onCreate={(text) => {
            props.onUnitText(text);
            props.onPatch({ unit: unitReference(text) });
          }}
          onBlur={props.onUnitBlur}
        />
        <Combobox
          name={`${path}.food`}
          aria-label={`${label} food`}
          placeholder="Food"
          className="min-w-40 grow-2"
          value={foodText}
          options={foodRows.map((row) => ({ value: row.id, label: row.name }))}
          disabled={disabled}
          onChange={props.onFoodText}
          onFocus={props.onFoodFocus}
          onSelect={(option) => {
            const row = foodRows.find((r) => r.id === option.value);
            if (!row) return;
            props.onFoodText(row.name);
            props.onPatch({ food: foodReference(row) });
          }}
          onCreate={(text) => {
            props.onFoodText(text);
            props.onPatch({ food: foodReference({ name: text }) });
          }}
          onBlur={props.onFoodBlur}
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
          onKeyDown={enterKey}
          onChange={(event) => props.onPatch({ note: event.target.value })}
        />
        <Checkbox
          name={`${path}.fixed`}
          label="Fixed"
          aria-label={`${label} fixed`}
          checked={ingredient.fixed ?? false}
          disabled={disabled}
          onCheckedChange={(fixed) => props.onPatch({ fixed })}
        />
        {controls}
      </div>
      {originalLine}
    </div>
  );
}

type IngredientRowProps = {
  ingredient: DraftIngredient;
  pi: number;
  ii: number;
  units: readonly Unit[];
  /** The other parts, as "move to" options (value is the part index). */
  parts: ComboboxOption[];
  errors: FieldErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<DraftIngredient>) => void;
  onMove: (toPi: number) => void;
  /** Enter on the row's last field (M21.4). */
  onEnter?: () => void;
};

function IngredientRow({ ingredient, pi, ii, units, parts, errors, disabled, onPatch, onMove, onEnter }: IngredientRowProps) {
  const path = `parts.${pi}.ingredients.${ii}`;
  const label = `Ingredient ${ii + 1}`;
  const [textOnly, setTextOnly] = useState(() => isTextOnly(ingredient));
  // Local text while a field is mid-edit; the committed value lives on the row.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitText, setUnitText] = useState(ingredient.unit?.name ?? "");
  const [foodText, setFoodText] = useState(ingredient.food?.name ?? "");
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The parse action (M17.6): null until Parse is pressed, or once its
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

  const moveTo =
    parts.length > 0 ? (
      <Select
        aria-label={`Move ${label.toLowerCase()} to part`}
        options={parts}
        placeholder="Move to…"
        disabled={disabled}
        className="w-36"
        onValueChange={(value) => onMove(Number(value))}
      />
    ) : null;

  const controls = (
    <>
      {modeToggle}
      {moveTo}
    </>
  );

  const fieldProps: Omit<IngredientFieldsProps, "showOriginalText"> = {
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
    controls,
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

  const summary = ingredientSummary(ingredient);

  return (
    <div className="flex flex-col gap-2" data-ingredient={ii} data-mode={textOnly ? "text" : "structured"}>
      {/* Phone: one line per row, tapped to open the sheet. From md the fields sit inline. */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm md:hidden"
        aria-label={`Edit ${label.toLowerCase()}`}
        aria-expanded={sheetOpen}
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
      >
        <span className="truncate">{summary === "" ? EMPTY_INGREDIENT_SUMMARY : summary}</span>
        <Chevron />
      </button>
      <div className="hidden md:flex md:flex-col md:gap-2" data-inline-fields="">
        <IngredientFields {...fieldProps} originalTextAbove />
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} size="sm" closable aria-label={label}>
        <Sheet.Header>
          <h2 className="text-base font-medium">{label}</h2>
        </Sheet.Header>
        <Sheet.Body>
          <IngredientFields {...fieldProps} showOriginalText />
        </Sheet.Body>
        <Sheet.Footer>
          <Button type="button" variant="solid" intent="brand" onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        </Sheet.Footer>
      </Sheet>
    </div>
  );
}
