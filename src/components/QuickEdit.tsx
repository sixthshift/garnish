// Quick edit from the recipe page (M27.5): fixing one ingredient or one step
// without opening the editor. A trigger at the row's end opens a `sheet` over
// that row alone — the editor's own `IngredientFields` for an ingredient, a
// `Textarea` with the same preview toggle the steps editor has for a step —
// and Save stays on the page.
//
// This is not Mealie's edit-in-place (decisions.md row 40 stands): the page
// never becomes a form. It is one row, in a sheet, and everything else on the
// page keeps reading.
//
// Three things it has to get right:
//
// - **The document it writes is the stored one.** Since M25.1 the page scales
//   the document client-side from `?servings`, so the rows on screen may be
//   showing amounts that were never stored. The provider carries the recipe as
//   the loader read it, and `withIngredientReplaced` / `withStepReplaced` build
//   the whole draft from that, with exactly one row changed.
// - **Ids survive.** Ticks are `sessionStorage`, keyed by recipe id and row id
//   (src/lib/ticks.ts), so a save that regenerated child ids would silently
//   clear the cook's ticks. `draftFromRecipe` copies ids across and nothing
//   here mints new ones.
// - **The whole document goes.** `updateRecipe` takes a complete `RecipeInput`
//   and replaces the recipe, so a partial write would drop everything it
//   omitted. The draft is the stored document with one row swapped.
//
// The two rows differ in their trigger (M29.4 — fewer controls). An
// ingredient's is a pencil, invisible until wanted: from `md` it appears on
// hover or focus. Below `md`, where there is no hover, there is no
// alternative any more — an ingredient is edited from the editor instead. A
// step's is a quiet "…" menu (`ui/Menu`) in the card's corner, holding one
// item, "Edit step"; it is always visible, since a step card has no hover
// affordance of its own to borrow. Both carry `data-print="hide"`: a printed
// recipe has no controls.
//
// Rows render the pencil only inside `QuickEditProvider`, which the view route
// supplies; in cook mode and the phone's merged ingredient list there is none,
// and the rows are exactly what they were. The merged list is deliberate: a
// summary row can be two parts' ingredients added together, so there is no one
// stored row for it to edit.
//
// Sheets only paint after mounting on the client, so each one's form lives in
// a `*Body` that renders anywhere and is what the tests exercise, as
// MadeThisSheet does.
import { Button } from "@sixthshift/design-system/button";
import { Sheet } from "@sixthshift/design-system/sheet";
import { Textarea } from "@sixthshift/design-system/textarea";
import { Toggle } from "@sixthshift/design-system/toggle";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { Food as FoodRow } from "../db/models/food/repo";
import type { Recipe, Unit } from "../domain/recipe";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import { listFoods } from "../server/foods";
import { updateRecipe } from "../server/recipes";
import { listUnits } from "../server/units";
import {
  FOOD_SEARCH_DEBOUNCE_MS,
  foodReference,
  IngredientFields,
  isTextOnly,
  matchUnit,
  textOnlyPatch,
  unitReference,
} from "./IngredientsEditor";
import { Markdown } from "./Markdown";
import { Menu } from "./ui/Menu";
import { draftFromRecipe, type DraftIngredient, type RecipeDraft, validateDraft } from "./RecipeForm";

// --- Pure helpers -----------------------------------------------------------

/**
 * The stored recipe as a draft with one ingredient replaced: part `partId`'s
 * `ingredientId` becomes `next`, keeping its place in the list. Every other
 * row, and every id in the document, comes across untouched — the ticks in
 * `sessionStorage` are keyed by those ids. An unknown part or ingredient
 * returns the document unchanged. Pure.
 */
export function withIngredientReplaced(recipe: Recipe, partId: string, ingredientId: string, next: DraftIngredient): RecipeDraft {
  const draft = draftFromRecipe(recipe);
  return {
    ...draft,
    parts: draft.parts.map((part) =>
      part.id !== partId
        ? part
        : {
            ...part,
            ingredients: part.ingredients.map((ingredient) => (ingredient.id === ingredientId ? { ...next, id: ingredient.id } : ingredient)),
          },
    ),
  };
}

/**
 * The stored recipe as a draft with one step's text replaced: part `partId`'s
 * `stepId` keeps its id and its place and gets `text`. An unknown part or step
 * returns the document unchanged. Pure.
 */
export function withStepReplaced(recipe: Recipe, partId: string, stepId: string, text: string): RecipeDraft {
  const draft = draftFromRecipe(recipe);
  return {
    ...draft,
    parts: draft.parts.map((part) =>
      part.id !== partId ? part : { ...part, steps: part.steps.map((step) => (step.id === stepId ? { ...step, text } : step)) },
    ),
  };
}

/** Run a write and refresh the loaders: `useMutate`'s shape, taken as an argument so a test can stand in for it. */
export type RunWrite = <T>(write: () => Promise<T>) => Promise<T>;

/**
 * Validate a quick edit's draft and write the whole document through
 * `updateRecipe`. The same `validateDraft` the editor's Save uses, so a row
 * that cannot be stored is refused here rather than half-written; the message
 * thrown is the first field error, which is what the sheet shows.
 */
export async function saveQuickEdit(draft: RecipeDraft, run: RunWrite): Promise<void> {
  const id = draft.id;
  if (id === undefined) throw new Error("This recipe has not been saved yet");
  const result = validateDraft(draft);
  if (!result.ok) throw new Error(Object.values(result.errors)[0] ?? "This edit is not valid");
  await run(() => updateRecipe({ data: { id, doc: result.data } }));
}

// --- The page's quick-edit context ------------------------------------------

/** What a row needs to edit itself: the stored (unscaled) document, and the page's `mutate`. */
export type QuickEditContext = { recipe: Recipe; run: RunWrite };

const Context = createContext<QuickEditContext | null>(null);

/**
 * Makes every ingredient and step row below it quick-editable. The recipe must
 * be the stored document, not the scaled view of it: what a save writes is
 * this, with one row changed.
 */
export function QuickEditProvider({ recipe, children }: { recipe: Recipe; children: ReactNode }) {
  const run = useMutate();
  return <Context.Provider value={{ recipe, run }}>{children}</Context.Provider>;
}

/** The quick-edit context, or null outside a provider (cook mode, the editor). */
export function useQuickEditContext(): QuickEditContext | null {
  return useContext(Context);
}

// --- The ingredient sheet ----------------------------------------------------

export type QuickEditIngredientBodyProps = {
  ingredient: DraftIngredient;
  /** The units list, loaded when the sheet opened. */
  units: readonly Unit[];
  busy?: boolean;
  /** The error a failed save left, shown above the buttons. */
  error?: string | null;
  onSave: (next: DraftIngredient) => void;
  onCancel: () => void;
};

/**
 * One ingredient's fields in a sheet. The editor's `IngredientFields`
 * unchanged, so a row edits the same way in both places; this owns the
 * mid-edit text and the food suggestions the editor's own row owns, and the
 * edited row itself, which only leaves here on Save.
 */
export function QuickEditIngredientBody({ ingredient, units, busy = false, error = null, onSave, onCancel }: QuickEditIngredientBodyProps) {
  const [row, setRow] = useState<DraftIngredient>(ingredient);
  const [textOnly, setTextOnly] = useState(() => isTextOnly(ingredient));
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [unitText, setUnitText] = useState(ingredient.unit?.name ?? "");
  const [foodText, setFoodText] = useState(ingredient.food?.name ?? "");
  const [foodFocused, setFoodFocused] = useState(false);
  const [foodRows, setFoodRows] = useState<FoodRow[]>([]);

  const patch = (next: Partial<DraftIngredient>) => setRow((current) => ({ ...current, ...next }));

  // Suggestions while the food input has focus, a beat after the last
  // keystroke — the editor's rule, and its debounce.
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

  /** A typed unit name becomes the matching unit, or a reference the save creates. The editor's `commitUnit`. */
  const commitUnit = () => {
    const text = unitText.trim();
    if (text === "") {
      patch({ unit: null });
      return;
    }
    const match = matchUnit(units, text);
    if (match) {
      patch({ unit: match });
      setUnitText(match.name);
      return;
    }
    if (row.unit && row.unit.name.toLowerCase() === text.toLowerCase()) return;
    patch({ unit: unitReference(text) });
  };

  /** The same for the food: an existing row when the name matches one, a reference the save finds or creates otherwise. */
  const commitFood = () => {
    const text = foodText.trim();
    if (text === "") {
      patch({ food: null });
      return;
    }
    const match = foodRows.find((candidate) => candidate.name.toLowerCase() === text.toLowerCase());
    if (match) {
      patch({ food: foodReference(match) });
      setFoodText(match.name);
      return;
    }
    if (row.food && row.food.name.toLowerCase() === text.toLowerCase()) return;
    patch({ food: foodReference({ name: text }) });
  };

  const modeToggle = (
    <Toggle
      type="button"
      variant="ghost"
      intent="neutral"
      size="sm"
      aria-label="Ingredient text only"
      pressed={textOnly}
      disabled={busy}
      onPressedChange={(pressed) => {
        setTextOnly(pressed);
        if (pressed) {
          setUnitText("");
          setFoodText("");
          setQuantityDraft(null);
        }
        patch(textOnlyPatch(pressed));
      }}
    >
      Text
    </Toggle>
  );

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Edit ingredient</h2>
      </Sheet.Header>
      <Sheet.Body>
        <IngredientFields
          ingredient={row}
          path="ingredient"
          label="Ingredient"
          units={units}
          errors={{}}
          disabled={busy}
          textOnly={textOnly}
          quantityDraft={quantityDraft}
          unitText={unitText}
          foodText={foodText}
          foodRows={foodRows}
          controls={modeToggle}
          showOriginalText
          onPatch={patch}
          onQuantityText={setQuantityDraft}
          onUnitText={setUnitText}
          onUnitBlur={commitUnit}
          onFoodText={setFoodText}
          onFoodFocus={() => setFoodFocused(true)}
          onFoodBlur={() => {
            setFoodFocused(false);
            commitFood();
          }}
        />
        {error !== null && (
          <p className="mt-2 text-sm text-fg-danger" role="alert">
            {error}
          </p>
        )}
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={() => onSave(row)}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type QuickEditIngredientSheetProps = QuickEditIngredientBodyProps & { open: boolean };

export function QuickEditIngredientSheet({ open, ...props }: QuickEditIngredientSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Edit ingredient">
      <QuickEditIngredientBody {...props} />
    </Sheet>
  );
}

// --- The step sheet ----------------------------------------------------------

export type QuickEditStepBodyProps = {
  text: string;
  busy?: boolean;
  error?: string | null;
  /** Open in preview rather than editing; the toggle moves it after that, and tests use it to render that state. */
  preview?: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
};

/**
 * One step's text in a sheet: a `Textarea`, and the steps editor's Preview
 * toggle beside it, because a step is markdown and the only way to see what a
 * stray underscore did is to render it (decisions.md row 56).
 */
export function QuickEditStepBody({ text, busy = false, error = null, preview = false, onSave, onCancel }: QuickEditStepBodyProps) {
  const [value, setValue] = useState(text);
  const [previewing, setPreviewing] = useState(preview);

  return (
    <>
      <Sheet.Header>
        <h2 className="text-base font-medium">Edit step</h2>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Toggle
              type="button"
              variant="ghost"
              intent="neutral"
              size="sm"
              aria-label="Preview step"
              pressed={previewing}
              disabled={busy}
              onPressedChange={setPreviewing}
            >
              Preview
            </Toggle>
          </div>
          {previewing ? (
            <div className="min-h-24 rounded-md border border-border-normal bg-bg-subtle px-3 py-2 text-sm" data-step-preview="">
              <Markdown source={value} />
            </div>
          ) : (
            <Textarea aria-label="Step" rows={6} placeholder="What to do" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} />
          )}
          {error !== null && (
            <p className="text-sm text-fg-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Sheet.Body>
      <Sheet.Footer>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={() => onSave(value)}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Sheet.Footer>
    </>
  );
}

export type QuickEditStepSheetProps = QuickEditStepBodyProps & { open: boolean };

export function QuickEditStepSheet({ open, ...props }: QuickEditStepSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && props.onCancel()} size="sm" closable aria-label="Edit step">
      <QuickEditStepBody {...props} />
    </Sheet>
  );
}

// --- The trigger a row renders ------------------------------------------------

/** A pencil, drawn the way the recipe route draws its own. */
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <title>Edit</title>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19 3 20l1-4Z" />
    </svg>
  );
}

function pencil(label: string, onOpen: () => void) {
  return (
    <button
      type="button"
      aria-label={label}
      data-print="hide"
      data-testid="quick-edit-trigger"
      className="mt-0.5 shrink-0 rounded p-1 text-fg-subtle transition-opacity hover:text-fg-normal focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      onClick={onOpen}
    >
      <PencilIcon />
    </button>
  );
}

/** The step card's own trigger: a quiet "…" menu in its corner, one item, "Edit step" — the pencil and the long press below `md` are gone (M29.4). */
function stepMenu(onOpen: () => void) {
  return (
    <div data-print="hide" className="mt-0.5 shrink-0">
      <Menu label="Step actions" iconOnly>
        <Menu.Item onSelect={onOpen}>Edit step</Menu.Item>
      </Menu>
    </div>
  );
}

/**
 * The quick edit for one ingredient row: the hover pencil (`md` and up) and
 * its sheet, or nothing outside the recipe page. Outside a
 * `QuickEditProvider`, or for a row whose part is unknown (the merged summary
 * list), there is nothing to render: the row is what it always was. Below
 * `md`, where there is no hover, an ingredient is edited from the editor
 * instead (M29.4 dropped the long-press alternative here).
 */
export function useQuickEditIngredient(partId: string | undefined, ingredientId: string): ReactNode {
  const context = useQuickEditContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<readonly Unit[]>([]);

  // The units list is the sheet's, not the page's: it is only worth a request
  // once a row is actually being edited.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    listUnits({ data: {} })
      .then((rows) => {
        if (!stale) setUnits(rows);
      })
      .catch(() => {
        if (!stale) setUnits([]);
      });
    return () => {
      stale = true;
    };
  }, [open]);

  if (context === null || partId === undefined) return null;

  const part = context.recipe.parts.find((candidate) => candidate.id === partId);
  const stored = part?.ingredients.find((candidate) => candidate.id === ingredientId);
  if (stored === undefined) return null;

  const save = async (next: DraftIngredient) => {
    setBusy(true);
    setError(null);
    try {
      await saveQuickEdit(withIngredientReplaced(context.recipe, partId, ingredientId, next), context.run);
      notify({ intent: "success", title: "Ingredient saved" });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this ingredient");
      notifyError("Couldn't save this ingredient", cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pencil("Edit ingredient", () => setOpen(true))}
      <QuickEditIngredientSheet
        open={open}
        // The stored row, never the scaled one on screen: this is what a save writes back.
        ingredient={{ ...stored }}
        units={units}
        busy={busy}
        error={error}
        onSave={(next) => void save(next)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/**
 * The quick edit for one step: the corner "…" menu (`stepMenu`) and its
 * sheet. Same context and "unknown row" rules as `useQuickEditIngredient`.
 */
export function useQuickEditStep(partId: string | undefined, stepId: string): ReactNode {
  const context = useQuickEditContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (context === null || partId === undefined) return null;

  const part = context.recipe.parts.find((candidate) => candidate.id === partId);
  const stored = part?.steps.find((candidate) => candidate.id === stepId);
  if (stored === undefined) return null;

  const save = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      await saveQuickEdit(withStepReplaced(context.recipe, partId, stepId, text), context.run);
      notify({ intent: "success", title: "Step saved" });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this step");
      notifyError("Couldn't save this step", cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {stepMenu(() => setOpen(true))}
      <QuickEditStepSheet open={open} text={stored.text} busy={busy} error={error} onSave={(text) => void save(text)} onCancel={() => setOpen(false)} />
    </>
  );
}
