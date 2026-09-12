// The way into a new recipe (M19.2, decisions.md row 52): paste the thing,
// look at what it was read as, then edit it. The blank form is still there —
// "Start blank" — but it is no longer the only door, because a recipe almost
// always arrives as text and typing it back in one field at a time is the
// slowest way to get it here.
//
// Three stages, one component:
//
//   paste    a textarea and Continue.
//   review   `splitRecipe` (M19.1) has divided the paste into a title, the
//            ingredient lines and the step lines; each ingredient line has
//            been through `parseIngredient` (M17.4) and shows as a review row
//            (M17.5), and the steps show as a numbered list. Nothing is
//            created and nothing is saved.
//   form     Create hands `RecipeForm` a `RecipeDraft`. The recipe is still
//            unsaved; only the foods and units the reviewer explicitly
//            approved have been written, through the same
//            `findOrCreateFood`/`findOrCreateUnit` bulk add uses.
//
// The split is rules-based on purpose. `claude -p` import is Later (scope.md)
// and when it lands it replaces `splitRecipe`, not the review — the review is
// the part worth keeping whichever way the text was read.
//
// Split the way the rest of the editor is: `RecipeImportPaste` and
// `RecipeImportReview` are plain functions of their props, so a test can
// render and drive them without a DOM; `RecipeImport` holds the stage, the
// text, the rows and the food vocabulary around them.
import { Button } from "@sixthshift/design-system/button";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { useState } from "react";
import type { Food as FoodRow } from "../db/models/food/repo";
import { pendingCreations, type RowCommit, rowCommit } from "../domain/bulkIngredients";
import type { Unit } from "../domain/recipe";
import { splitRecipe } from "../domain/splitRecipe";
import { reviewRows } from "../domain/bulkIngredients";
import { messageFrom } from "../lib/notify";
import { findOrCreateFood, listFoods } from "../server/foods";
import { findOrCreateUnit } from "../server/units";
import { IngredientReviewRow, type IngredientReview } from "./IngredientReviewRow";
import { filterUnits, reviewedIngredient } from "./IngredientsEditor";
import { emptyDraft, type RecipeDraft } from "./RecipeForm";
import { newStep } from "./StepsEditor";

/** Which stage the import is on. `null` means the caller has a draft and this component is done. */
export type ImportStage = "paste" | "review";

/**
 * The reviewed paste as a draft: the title as the name, the ingredient rows
 * and the step lines both in the unnamed part, everything else left at
 * `emptyDraft`'s defaults. `createdFoods`/`createdUnits` are the rows Create
 * found or created, keyed by the lowercased name that was approved — a row
 * whose food was declined or whose creation failed lands text-only, exactly
 * as it does in bulk add. Pure apart from the ids it fills in.
 */
export function draftFromImport(opts: {
  title: string | null;
  commits: readonly RowCommit<Unit, FoodRow>[];
  steps: readonly string[];
  createdFoods: ReadonlyMap<string, FoodRow>;
  createdUnits: ReadonlyMap<string, Unit>;
}): RecipeDraft {
  const draft = emptyDraft();
  const part = draft.parts[0]!;
  return {
    ...draft,
    name: (opts.title ?? "").trim(),
    parts: [
      {
        ...part,
        ingredients: opts.commits.map((commit) => reviewedIngredient(commit, opts.createdFoods, opts.createdUnits)),
        steps: opts.steps.map((text) => newStep(text)),
      },
    ],
  };
}

/** "3 ingredients and 2 steps", "1 ingredient", "nothing we could read". Pure. */
export function importSummary(ingredients: number, steps: number): string {
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const phrases: string[] = [];
  if (ingredients > 0) phrases.push(count(ingredients, "ingredient"));
  if (steps > 0) phrases.push(count(steps, "step"));
  return phrases.length === 0 ? "nothing we could read" : phrases.join(" and ");
}

export type RecipeImportPasteProps = {
  text: string;
  disabled?: boolean;
  onTextChange: (text: string) => void;
  onContinue: () => void;
  onBlank: () => void;
};

/** The first stage: one box, and the two ways out of it. */
export function RecipeImportPaste({ text, disabled, onTextChange, onContinue, onBlank }: RecipeImportPasteProps) {
  return (
    <div className="flex flex-col gap-4" data-import-stage="paste">
      <Muted as="p" className="text-sm">
        Paste a recipe — the whole thing, headings and all. Ingredients and steps are worked out from the text and shown to you before anything is saved.
      </Muted>
      <Textarea
        aria-label="Pasted recipe"
        rows={16}
        spellCheck={false}
        placeholder={"Anzac biscuits\n\nIngredients\n1 cup plain flour\n125 g butter\n\nMethod\n1. Preheat the oven to 180°C."}
        value={text}
        disabled={disabled}
        onChange={(event) => onTextChange(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={disabled || text.trim() === ""} onClick={onContinue}>
          Continue
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={disabled} onClick={onBlank}>
          Start blank
        </Button>
      </div>
    </div>
  );
}

export type RecipeImportReviewProps = {
  title: string;
  rows: readonly IngredientReview[];
  steps: readonly string[];
  /** The units the page loaded, for the "pick an existing unit" picker. */
  units: readonly Unit[];
  /** Food suggestions for "pick existing"; the shell passes `listFoods`. */
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  error?: string | null;
  onTitleChange: (title: string) => void;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onCreate: () => void;
};

/**
 * The second stage: what the paste was read as. The ingredient rows are the
 * bulk-add review rows unchanged, so an unknown food is a proposal declined by
 * default and Create writes only what was approved. The steps are shown, not
 * edited — the form after this is the place to edit them, and a second editor
 * here would only be the same one twice.
 */
export function RecipeImportReview(props: RecipeImportReviewProps) {
  const { title, rows, steps, units, searchFoods, busy, error, onTitleChange, onRowsChange, onBack, onCreate } = props;
  return (
    <div className="flex flex-col gap-6" data-import-stage="review">
      <Muted as="p" className="text-sm">
        {`Read as ${importSummary(rows.length, steps.length)}. Nothing is saved yet, and no food or unit is created unless you ask for it below.`}
      </Muted>

      <FormField label="Name">
        <Input name="name" value={title} autoComplete="off" disabled={busy} onChange={(event) => onTitleChange(event.target.value)} />
      </FormField>

      <section className="flex flex-col gap-3" aria-label="Ingredients to review">
        <SectionTitle as="h2">Ingredients</SectionTitle>
        {rows.length === 0 ? (
          <Muted as="p" className="text-sm">
            No ingredient lines found. You can add them in the editor.
          </Muted>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.key} className="rounded-lg border border-border-normal p-3">
                <IngredientReviewRow
                  row={row}
                  label={`Line ${index + 1}`}
                  disabled={busy}
                  unitMatches={(text) => filterUnits(units, text)}
                  searchFoods={searchFoods}
                  onChange={(next) => onRowsChange(rows.map((current, i) => (i === index ? next : current)))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Steps to review">
        <SectionTitle as="h2">Steps</SectionTitle>
        {steps.length === 0 ? (
          <Muted as="p" className="text-sm">
            No steps found. You can add them in the editor.
          </Muted>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-6" data-import-steps="">
            {steps.map((step, index) => (
              <li key={`${index}-${step.slice(0, 24)}`} className="text-sm">
                {step}
              </li>
            ))}
          </ol>
        )}
      </section>

      {error != null && (
        <p className="text-sm text-fg-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy} onClick={onCreate}>
          {busy ? "Working…" : "Create"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export type RecipeImportProps = {
  /** The units the page loaded: the parser's unit vocabulary and the picker's options. */
  units: readonly Unit[];
  /** Called once with the draft the form should open on, once a paste has been reviewed. */
  onDraft: (draft: RecipeDraft) => void;
  /** "Start blank": the caller opens the empty editor, by navigation rather than by state. */
  onBlank: () => void;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
};

export function RecipeImport({ units, onDraft, onBlank, loadFoods }: RecipeImportProps) {
  const [stage, setStage] = useState<ImportStage>("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<IngredientReview[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFoods = loadFoods ?? (() => listFoods({ data: {} }));

  const proceed = async () => {
    setBusy(true);
    setError(null);
    try {
      // Parsing a whole paste needs every food, not the query-by-query slice
      // a row's combobox asks for — the same load bulk add does on open.
      const foods = await fetchFoods();
      const split = splitRecipe(text);
      setTitle(split.title ?? "");
      setRows(reviewRows(split.ingredients, { units, foods }));
      setSteps(split.steps);
      setStage("review");
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Create only what the reviewer approved, then hand the draft up. */
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const pending = pendingCreations(rows);
      const createdFoods = new Map<string, FoodRow>();
      for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
      const createdUnits = new Map<string, Unit>();
      for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
      onDraft(draftFromImport({ title, commits: rows.map(rowCommit), steps, createdFoods, createdUnits }));
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  if (stage === "paste") {
    return (
      <RecipeImportPaste
        text={text}
        disabled={busy}
        onTextChange={setText}
        onContinue={() => void proceed()}
        onBlank={onBlank}
      />
    );
  }

  return (
    <RecipeImportReview
      title={title}
      rows={rows}
      steps={steps}
      units={units}
      searchFoods={(q) => listFoods({ data: { q } })}
      busy={busy}
      error={error}
      onTitleChange={setTitle}
      onRowsChange={setRows}
      onBack={() => {
        setStage("paste");
        setError(null);
      }}
      onCreate={() => void create()}
    />
  );
}
