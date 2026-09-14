// The first question about a new recipe: where is it from? (M23.6,
// decisions.md row 57.)
//
// Three stages behind one route:
//
//   choose   a web page, a Mealie or Tandoor export, or your own.
//   url      a URL, fetched through `importFromUrl` (M23.5). What comes back
//            is either a schema.org recipe or an OpenGraph stub, and the
//            review says which — a stub has a name and a picture and nothing
//            else, and pretending otherwise would waste your time.
//   review   the fields as chips, the ingredient lines through
//            `parseIngredient` and the M17.5 review rows, the steps as a
//            numbered list per part. Create builds the draft, fills
//            `sourceUrl`, and creates only the foods and units approved here.
//
//   file     a Mealie or Tandoor export — a backup zip or one recipe's JSON —
//            read by `importMealie` (M34.3) or `importTandoor` (M34.4), told
//            apart by shape. A file holding several recipes asks which one
//            first. It lands on the same review as a scraped page, with its
//            parts already made from Mealie's section titles or Tandoor's
//            steps.
//
//   paste    a block of text, read by a hosted model on the server (M34.5,
//            M36.1, decisions.md rows 74 and 75). What you have is prose, and
//            no rule reads prose. Offered only when a key is configured, and
//            it lands on the same review.
//
// With a model configured the read is no longer something you ask for on a
// page: every URL result is handed to the model on arrival (M36.6,
// decisions.md row 77). The rules result renders at once — it is the whole of
// what you get when no model is configured, when the read fails, and when the
// check rejects the answer — and the review re-renders from the model's
// reading when it lands. A `schema` result is sent anchored, so the page's own
// lines and steps are the content and the model only says which part each sits
// under; a `stub` result is sent unanchored, since there is nothing to anchor
// to. Create is never blocked on it: a recipe whose lines are one flat list is
// already correct, and waiting for a second opinion on that would be waiting
// for nothing.
//
// "My own" is a navigation, not a stage: `?source=manual` renders the editor
// directly, so the browser's Back leaves it the way it leaves any other
// screen.
//
// Split the way the rest of the editor is: every stage is a plain function of
// its props so a test can render and drive it without a DOM, and `RecipeSource`
// holds the state around them.
import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Card } from "@sixthshift/design-system/card";
import { FormField } from "@sixthshift/design-system/form-field";
import { Input } from "@sixthshift/design-system/input";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Textarea } from "@sixthshift/design-system/textarea";
import { type FormEvent, useState } from "react";
import type { Food as FoodRow } from "../../db/models/food/repo";
import { pendingCreations, reviewRows, type RowCommit, rowCommit } from "../../domain/ingredient/bulkIngredients";
import type { ImportCheck } from "../../domain/import/importCheck";
import { type MealieRecipe, reviewRowsFromMealie } from "../../domain/import/importMealie";
import { type ExportRecipe, isTandoorRecipe, reviewRowsFromTandoor } from "../../domain/import/importTandoor";
import type { Tag, Unit } from "../../domain/recipe/recipe";
import { ingredientLines, type ScrapedRecipe } from "../../domain/import/schemaRecipe";
import { suggestLinks } from "../../domain/recipe/stepIngredients";
import { randomUuid } from "../../lib/ids";
import { postImportFile } from "../../lib/importFile";
import { messageFrom } from "../../lib/notify";
import { foodForRecipe, findOrCreateFood, listFoods } from "../../server/fns/foods";
import { getRecipe, recipeByName } from "../../server/fns/recipes";
import type { ImportedRecipe, ImportSource } from "../../server/import/fromUrl";
import { importFromUrl } from "../../server/import/fromUrl";
import { findOrCreateUnit } from "../../server/fns/units";
import { importFromText } from "../../server/ai/import";
import { IngredientReviewRow, type IngredientReview } from "./IngredientReviewRow";
import { filterUnits, reviewedIngredient } from "../recipe/editor/IngredientsEditor";
import { emptyDraft, type DraftPart, type RecipeDraft, tagsFromNames } from "../recipe/editor/RecipeForm";
import { newStep } from "../recipe/editor/StepsEditor";

/**
 * `part` with `suggestLinks` (M28.2) run over its steps, so an imported
 * recipe arrives with its links filled for review. `suggestLinks` needs an
 * id on every row to name it in a link; the scraper's rows already carry
 * one (`newStep`, `reviewedIngredient`), but a fresh id is given here too,
 * defensively, rather than trusting that.
 */
function withSuggestedLinks(part: DraftPart): DraftPart {
  const ingredients = part.ingredients.map((ingredient) => ({
    ...ingredient,
    id: ingredient.id ?? randomUuid(),
    food: ingredient.food ?? null,
  }));
  const steps = suggestLinks({
    ingredients,
    steps: part.steps.map((step) => ({
      ...step,
      id: step.id ?? randomUuid(),
      text: step.text ?? "",
      ingredientIds: step.ingredientIds ?? [],
    })),
  });
  return { ...part, ingredients, steps };
}

/**
 * `part` with the links the source already knew (M34.4): `stepOfRow[i]` is the
 * step that owns the part's i-th row, or -1 for a row no step claimed. Used
 * instead of `suggestLinks` when the export says outright which step a row was
 * written under — Tandoor's steps own their ingredients — because a stated
 * answer beats a guessed one.
 */
function withStepRows(part: DraftPart, stepOfRow: readonly number[]): DraftPart {
  const ingredients = part.ingredients.map((ingredient) => ({
    ...ingredient,
    id: ingredient.id ?? randomUuid(),
    food: ingredient.food ?? null,
  }));
  const steps = part.steps.map((step, stepIndex) => ({
    ...step,
    id: step.id ?? randomUuid(),
    text: step.text ?? "",
    ingredientIds: ingredients.filter((_, row) => stepOfRow[row] === stepIndex).map((ingredient) => ingredient.id),
  }));
  return { ...part, ingredients, steps };
}

/** Which source the chooser is on. `paste` is the AI rung (M34.5) and only appears when `claude` is installed. */
export type SourceKind = "url" | "manual" | "file" | "paste";

/**
 * A scraped recipe and its reviewed ingredient lines as a draft. The parts are
 * the source's own (decisions.md row 59), and each row goes back on the part
 * whose line it was parsed from: the review's rows are the parts' lines
 * flattened in part order (M36.2), so the parts' own counts are the allocation
 * and nothing has to carry it alongside. A schema.org page puts every line on
 * the unnamed body because that is all its markup can say; a Mealie or Tandoor
 * export, or a model that read the headings, says more, and this reads all of
 * them the same way. Each part then runs through `suggestLinks` (M28.2), so
 * the draft arrives with its step-ingredient links already filled for review.
 * Pure apart from the ids it fills in.
 */
export function draftFromScraped(opts: {
  scraped: ScrapedRecipe;
  sourceUrl: string;
  commits: readonly RowCommit<Unit, FoodRow>[];
  createdFoods: ReadonlyMap<string, FoodRow>;
  createdUnits: ReadonlyMap<string, Unit>;
  knownTags?: readonly Tag[];
  /**
   * Which step of its part each commit was written under, by index, -1 for
   * none (M34.4). Given, the links are taken from it rather than guessed by
   * `suggestLinks`; only Tandoor's steps know.
   */
  rowSteps?: readonly number[];
  /** Notes the source carried (Mealie's `notes`). */
  notes?: readonly { title: string; text: string }[];
  /** A rating the source carried, 1 to 5. */
  rating?: number | null;
}): RecipeDraft {
  const { scraped, sourceUrl, commits, createdFoods, createdUnits, knownTags = [], rowSteps, notes = [], rating = null } = opts;
  const rows = commits.map((commit) => reviewedIngredient(commit, createdFoods, createdUnits));

  const parts: DraftPart[] = scraped.parts.map((part) => ({
    id: randomUuid(),
    name: part.name,
    ingredients: [],
    steps: part.steps.map((step) => newStep(step)),
  }));
  // A source with no parts at all still needs somewhere to put its rows.
  if (parts.length === 0) parts.push({ id: randomUuid(), name: "", ingredients: [], steps: [] });
  // The part each row came off, by index: part 0 owns its first
  // `parts[0].ingredients.length` rows, and so on down the list. A row past the
  // last line — nothing produces one today — falls to the first part rather
  // than being dropped.
  const rowParts = scraped.parts.flatMap((part, index) => part.ingredients.map(() => index));
  rows.forEach((row, index) => (parts[rowParts[index] ?? 0] ?? parts[0]!).ingredients.push(row));

  // The steps each part's rows were written under, in the order the rows were
  // pushed onto that part, so `withStepRows` can read them off positionally.
  const stepsPerPart: number[][] = parts.map(() => []);
  if (rowSteps !== undefined) {
    rows.forEach((_, index) => stepsPerPart[rowParts[index] ?? 0]?.push(rowSteps[index] ?? -1));
  }
  const linked = parts.map((part, index) => (rowSteps === undefined ? withSuggestedLinks(part) : withStepRows(part, stepsPerPart[index] ?? [])));

  return {
    ...emptyDraft(),
    name: scraped.name,
    description: scraped.description,
    recipeServings: scraped.servings,
    // A yield of "24 biscuits" is worth keeping whole; a bare "4" is servings
    // and nothing more, so it would only read as "4" twice.
    recipeYieldQuantity: scraped.yieldText === "" ? 0 : scraped.servings,
    recipeYield: scraped.yieldText,
    prepTime: scraped.prepMinutes,
    performTime: scraped.cookMinutes,
    sourceUrl: sourceUrl.trim() === "" ? null : sourceUrl.trim(),
    rating,
    notes: notes.filter((note) => note.text.trim() !== "" || note.title.trim() !== "").map((note) => ({ title: note.title, text: note.text })),
    tags: tagsFromNames(scraped.tags, knownTags),
    parts: linked.length > 0 ? linked : emptyDraft().parts,
  };
}

/** "24 biscuits", "Serves 4", or "" when the page did not say. Pure. */
export function yieldLabel(scraped: ScrapedRecipe): string {
  if (scraped.servings > 0 && scraped.yieldText !== "") return `${scraped.servings} ${scraped.yieldText}`;
  if (scraped.servings > 0) return `Serves ${scraped.servings}`;
  return scraped.yieldText;
}

/** How many ingredient lines came back across every part. Pure. */
export function ingredientCount(scraped: ScrapedRecipe): number {
  return ingredientLines(scraped).length;
}

/** How many steps came back across every part. Pure. */
export function stepCount(scraped: ScrapedRecipe): number {
  return scraped.parts.reduce((total, part) => total + part.steps.length, 0);
}

/**
 * What the review says it got, and how. `sorted` is the model's part in it
 * (M36.6): true when the parts on the screen are the model's reading of the
 * page's headings, false when a `schema` page arrived with no model to sort
 * it, and null when the question does not arise — a paste, an upload, a read
 * still running. Pure.
 */
export function importSummary(from: ImportSource, ingredients: number, steps: number, sorted: boolean | null = null): string {
  if (from === "stub") return "That page has no recipe data, so this is just its title and picture. The rest is yours to type in.";
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const read = `Read ${count(ingredients, "ingredient")} and ${count(steps, "step")}.`;
  const nothingSaved = "Nothing is saved yet, and no food or unit is created unless you ask for it below.";
  // An anchored read changed nothing but the shape: the lines are the page's
  // own, checked against it word for word, and the parts are what the model
  // added. Saying so tells the household what is worth checking.
  if (sorted === true) {
    return `The page's ${count(ingredients, "ingredient")} and ${count(steps, "step")} sorted into parts by the model. The words are the page's own — check the parts. ${nothingSaved}`;
  }
  // An AI read is a reading, not a transcription, so the review is told to
  // check it rather than merely approve it (M34.5).
  if (from === "ai") return `Claude ${read.toLowerCase()} Check them against what you pasted — nothing is saved yet, and no food or unit is created unless you ask for it below.`;
  // No model to read the page, so the headings it had are gone: schema.org
  // cannot say which part a line belongs to, and nothing else was asked.
  if (sorted === false) return `${read} No model is configured, so the page's sections were not sorted into parts and every line is on the main body. ${nothingSaved}`;
  return `${read} ${nothingSaved}`;
}

/**
 * What the model's version did to the page's, as the review says it: "dropped
 * 1 line and reworded 2 steps". A line missing on one side and one added on
 * the other is one rewording rather than two changes, because that is what it
 * is and counting it twice would overstate the damage. Pure.
 */
export function changeSummary(check: ImportCheck): string {
  const clauses: string[] = [];
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  for (const [missing, added, noun] of [
    [check.missingLines, check.addedLines, "line"],
    [check.missingSteps, check.addedSteps, "step"],
  ] as const) {
    const reworded = Math.min(missing.length, added.length);
    if (missing.length - reworded > 0) clauses.push(`dropped ${count(missing.length - reworded, noun)}`);
    if (added.length - reworded > 0) clauses.push(`added ${count(added.length - reworded, noun)}`);
    if (reworded > 0) clauses.push(`reworded ${count(reworded, noun)}`);
  }
  if (clauses.length === 0) return "changed nothing";
  if (clauses.length === 1) return clauses[0]!;
  return `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}

/** The rejection notice in one sentence (M36.6). Pure. */
export function rejectionMessage(check: ImportCheck): string {
  return `The model's version ${changeSummary(check)}, so the page's version is shown.`;
}

/** Every line the check objected to, labelled for the list under the notice. Pure. */
export function changedLines(check: ImportCheck): { label: string; text: string }[] {
  return [
    ...check.missingLines.map((text) => ({ label: "Dropped", text })),
    ...check.addedLines.map((text) => ({ label: "Added", text })),
    ...check.missingSteps.map((text) => ({ label: "Dropped step", text })),
    ...check.addedSteps.map((text) => ({ label: "Added step", text })),
  ];
}

/**
 * Whether this result is worth handing to the model on arrival (M36.6). Only
 * a page: an upload already states its parts and a paste has already been
 * read. A `schema` result goes anchored and a `stub` result goes bare, and
 * neither goes anywhere without the page's text to read.
 *
 * A result that already carries a `check` has been past the model on the
 * server (M36.7's pasted HTML, which runs the whole pipeline there), so it is
 * shown as it stands. Reading it again would only ask the same model the same
 * question twice.
 */
export function shouldReadWithModel(imported: ImportedRecipe, aiAvailable: boolean): boolean {
  if (!aiAvailable) return false;
  if (imported.check !== undefined) return false;
  if (imported.from !== "schema" && imported.from !== "stub") return false;
  return imported.pageText.trim() !== "";
}

/** The AI read as the review needs it: the page's text, and the rules result as the anchor when it had one. */
export type ModelReader = (text: string, anchor?: ScrapedRecipe) => Promise<ImportedRecipe>;

/**
 * The model's pass over a rules result. The address and the page's text are
 * carried over from the rules result rather than taken from the answer, so a
 * retry, or the swap to a rejected answer, still has everything the first read
 * had. A failure is returned rather than thrown: the rules result stays on the
 * screen and the message goes beside it.
 */
export async function modelPass(
  imported: ImportedRecipe,
  read: ModelReader,
): Promise<{ ok: true; result: ImportedRecipe } | { ok: false; error: string }> {
  try {
    const anchor = imported.from === "schema" ? imported.recipe : undefined;
    const result = await read(imported.pageText, anchor);
    return { ok: true, result: { ...result, url: imported.url, pageText: imported.pageText } };
  } catch (cause) {
    return { ok: false, error: messageFrom(cause) };
  }
}

/**
 * The rejected answer put in the accepted one's place (M36.6's "Use the
 * model's version anyway"). `check` stays so the summary still says the parts
 * are the model's; `rejected` goes, because it is now what is on the screen.
 */
export function withRejectedAnswer(imported: ImportedRecipe): ImportedRecipe {
  if (imported.rejected === undefined) return imported;
  return { from: "ai", url: imported.url, recipe: imported.rejected, pageText: imported.pageText, check: imported.check };
}

/** The review's duplicate warning: the same recipe by address (M23.7) or by name (M34.3). Pure. */
export function duplicateMessage(name: string, by: DuplicateBy): string {
  return by === "name"
    ? `“${name}” is already here under that name. Creating this makes a second copy.`
    : `“${name}” was imported from the same address. Creating this makes a second copy.`;
}

/** How the review found the duplicate it is warning about. */
export type DuplicateBy = "url" | "name";

// --- Stages ----------------------------------------------------------------

export type SourceChooserProps = {
  onChoose: (kind: SourceKind) => void;
  disabled?: boolean;
  /** Whether `claude` is installed on the server (M34.5); without it the paste option is not offered. */
  aiAvailable?: boolean;
};

/** The first stage: the ways a recipe gets here. The pasted one appears only when the AI rung can run. */
export function SourceChooser({ onChoose, disabled, aiAvailable = false }: SourceChooserProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="choose">
      <SectionTitle as="h2">Where is this recipe from?</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          data-source="url"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("url")}
        >
          <span className="block font-medium">A web page</span>
          <Muted as="span" className="mt-1 block text-sm">
            Paste the address. The recipe is read off the page and shown to you before anything is saved.
          </Muted>
        </button>
        <button
          type="button"
          disabled={disabled}
          data-source="file"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("file")}
        >
          <span className="block font-medium">A Mealie or Tandoor export</span>
          <Muted as="span" className="mt-1 block text-sm">
            Upload a backup or a single recipe file. Everything it holds is shown to you before anything is saved.
          </Muted>
        </button>
        {aiAvailable && (
          <button
            type="button"
            disabled={disabled}
            data-source="paste"
            className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
            onClick={() => onChoose("paste")}
          >
            <span className="block font-medium">Pasted text</span>
            <Muted as="span" className="mt-1 block text-sm">
              A photo's text, an email, a page that gave nothing up. Claude reads it here on the server, and you check it before anything
              is saved.
            </Muted>
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          data-source="manual"
          className="rounded-xl border border-border-normal p-4 text-left hover:bg-bg-subtle disabled:opacity-50"
          onClick={() => onChoose("manual")}
        >
          <span className="block font-medium">My own</span>
          <Muted as="span" className="mt-1 block text-sm">
            Start with a blank recipe and type it in.
          </Muted>
        </button>
      </div>
    </div>
  );
}

export type UrlSourceProps = {
  url: string;
  busy?: boolean;
  error?: string | null;
  onUrlChange: (url: string) => void;
  onFetch: () => void;
  onBack: () => void;
};

/** The second stage: one address. */
export function UrlSource({ url, busy, error, onUrlChange, onFetch, onBack }: UrlSourceProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim() !== "") onFetch();
  };
  return (
    <form className="flex flex-col gap-4" data-source-stage="url" onSubmit={submit}>
      <SectionTitle as="h2">From a web page</SectionTitle>
      <FormField label="Address">
        <Input
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          aria-label="Recipe address"
          value={url}
          disabled={busy}
          onChange={(event) => onUrlChange(event.target.value)}
        />
      </FormField>
      {error != null && (
        <Message intent="danger" title="That page could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="solid" intent="brand" disabled={busy || url.trim() === ""}>
          {busy ? "Reading…" : "Read the page"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}

export type PasteSourceProps = {
  text: string;
  busy?: boolean;
  error?: string | null;
  onTextChange: (text: string) => void;
  onRead: () => void;
  onBack: () => void;
};

/**
 * The second stage for pasted text (M34.5): one box. What is in it goes to the
 * model on the server and comes back as the same reviewable recipe a scraped
 * page does — and if what was pasted is a page's own source (M36.7), through
 * the page rungs first, which is why the label asks for either. Nothing here
 * is saved, and the note says so, because handing a recipe to a model is
 * exactly the moment to be told what happens next.
 */
export function PasteSource({ text, busy, error, onTextChange, onRead, onBack }: PasteSourceProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="paste">
      <SectionTitle as="h2">From pasted text</SectionTitle>
      <Muted as="p" className="text-sm">
        Paste the whole recipe — ingredients and method together, in any order. If a site turned the address away, view its source,
        select all and paste that instead: the page's own data is read first, exactly as a successful fetch would have read it. Either
        way the model fills this app's fields and you check every line before anything is saved.
      </Muted>
      <FormField label="The recipe, or the page's HTML (view source, select all, copy)">
        <Textarea
          name="text"
          rows={12}
          aria-label="Pasted recipe"
          placeholder="Anzac biscuits&#10;&#10;1 cup plain flour&#10;125 g butter&#10;&#10;Mix the dry ingredients…"
          value={text}
          disabled={busy}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </FormField>
      {error != null && (
        <Message intent="danger" title="That text could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy || text.trim() === ""} onClick={onRead}>
          {busy ? "Reading…" : "Read the text"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export type FileSourceProps = {
  /** The chosen file, or null before one is picked. */
  file: File | null;
  busy?: boolean;
  error?: string | null;
  onFileChange: (file: File | null) => void;
  onRead: () => void;
  onBack: () => void;
};

/**
 * The second stage for an export: one file. A Mealie backup zip or one
 * recipe's JSON, or Tandoor's export zip — a `recipe.json` per recipe — told
 * apart by what is in it rather than by its name.
 */
export function FileSource({ file, busy, error, onFileChange, onRead, onBack }: FileSourceProps) {
  const inputId = "import-file";
  return (
    <div className="flex flex-col gap-4" data-source-stage="file">
      <SectionTitle as="h2">From a Mealie or Tandoor export</SectionTitle>
      <Muted as="p" className="text-sm">
        A Mealie backup or a Tandoor export <code>.zip</code>, or a single recipe saved as JSON. Nothing is saved until you have looked
        at it.
      </Muted>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-border-normal px-3 py-2 text-sm font-medium hover:bg-bg-subtle"
        >
          Choose file
        </label>
        <input
          id={inputId}
          name="file"
          type="file"
          accept=".zip,.json,application/zip,application/json"
          aria-label="Mealie or Tandoor export"
          className="sr-only"
          disabled={busy}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <span className="text-sm text-fg-subtle" data-testid="import-file-name">
          {file === null ? "No file chosen" : file.name}
        </span>
      </div>
      {error != null && (
        <Message intent="danger" title="That file could not be read" data-testid="import-error">
          {error}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="solid" intent="brand" disabled={busy || file === null} onClick={onRead}>
          {busy ? "Reading…" : "Read the file"}
        </Button>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export type RecipePickerProps = {
  recipes: readonly ExportRecipe[];
  busy?: boolean;
  onPick: (index: number) => void;
  onBack: () => void;
};

/** A backup holds a whole collection; one recipe is imported at a time, so it asks which. */
export function RecipePicker({ recipes, busy, onPick, onBack }: RecipePickerProps) {
  return (
    <div className="flex flex-col gap-4" data-source-stage="pick">
      <SectionTitle as="h2">{`That file holds ${recipes.length} recipes`}</SectionTitle>
      <Muted as="p" className="text-sm">
        Pick the one to import. Come back for the next one.
      </Muted>
      <ul className="flex flex-col gap-2">
        {recipes.map((recipe, index) => (
          <li key={`${index}-${recipe.name}`}>
            <button
              type="button"
              data-import-choice={String(index)}
              disabled={busy}
              className="w-full rounded-lg border border-border-normal p-3 text-left hover:bg-bg-subtle disabled:opacity-50"
              onClick={() => onPick(index)}
            >
              <span className="block font-medium">{recipe.name === "" ? "Untitled" : recipe.name}</span>
              <Muted as="span" className="mt-0.5 block text-xs">
                {`${ingredientCount(recipe)} ingredients, ${stepCount(recipe)} steps`}
              </Muted>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export type ImportReviewProps = {
  imported: ImportedRecipe;
  rows: readonly IngredientReview[];
  units: readonly Unit[];
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  error?: string | null;
  /** A recipe already here with the same source (M23.7) or the same name (M34.3, M34.4). */
  duplicate?: { name: string; slug: string } | null;
  /** Which of the two the duplicate was found by; the address, by default. */
  duplicateBy?: DuplicateBy;
  /** Whether a model is configured (M36.6); without one a `schema` page says its sections were not sorted. */
  aiAvailable?: boolean;
  /** Whether the model's read of this page is still running; the rows are the rules result meanwhile. */
  reading?: boolean;
  /** Why the model's read did not happen, shown beside the rules result with a retry. */
  readError?: string | null;
  /** Run the read again after a failure. */
  onRetryRead?: () => void;
  /** Take the rejected answer anyway (M36.6). */
  onUseRejected?: () => void;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onCreate: () => void;
};

/** The third stage: what the page gave up, before any of it is written. */
export function ImportReview(props: ImportReviewProps) {
  const { imported, rows, units, searchFoods, busy, error, duplicate, duplicateBy = "url", onRowsChange, onBack, onCreate } = props;
  const { aiAvailable = false, reading = false, readError = null, onRetryRead, onUseRejected } = props;
  const { recipe, from } = imported;
  const label = yieldLabel(recipe);
  // Whether the parts on the screen are the model's doing. An `ai` result that
  // carries a check was sorted against an anchor; an `ai` result without one is
  // a paste, which is a reading rather than a sorting. A `schema` result with
  // no model configured is the one case worth admitting to: its lines are all
  // on the main body because nothing was there to put them anywhere else.
  const sorted = from === "ai" ? (imported.check === undefined ? null : true) : from === "schema" && !aiAvailable ? false : null;
  const rejected = imported.rejected !== undefined && imported.check !== undefined ? imported.check : null;

  return (
    <div className="flex flex-col gap-6" data-source-stage="review" data-import-from={from}>
      {from === "stub" ? (
        <Message intent="warning" title="No recipe data on that page" data-testid="stub-notice">
          {importSummary(from, 0, 0)}
        </Message>
      ) : (
        <Muted as="p" className="text-sm">
          {importSummary(from, ingredientCount(recipe), stepCount(recipe), sorted)}
        </Muted>
      )}

      {reading && (
        <Muted as="p" className="text-sm" data-testid="sorting-notice">
          Sorting into parts…
        </Muted>
      )}

      {readError !== null && (
        <Message intent="warning" title="The model could not read this page" data-testid="read-error">
          <div className="flex flex-col items-start gap-2">
            <span>{`${readError} The page's own reading is below and can be saved as it is.`}</span>
            {onRetryRead !== undefined && (
              <Button type="button" variant="ghost" intent="neutral" disabled={busy || reading} onClick={onRetryRead}>
                Try again
              </Button>
            )}
          </div>
        </Message>
      )}

      {rejected !== null && (
        <Message intent="warning" title="The model changed more than the parts" data-testid="rejected-notice">
          <div className="flex flex-col items-start gap-2">
            <span>{rejectionMessage(rejected)}</span>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm">
              {changedLines(rejected).map((line, index) => (
                <li key={`${index}-${line.label}`} data-changed-line={line.label}>
                  {`${line.label}: “${line.text}”`}
                </li>
              ))}
            </ul>
            {onUseRejected !== undefined && (
              <Button type="button" variant="ghost" intent="neutral" disabled={busy} onClick={onUseRejected}>
                Use the model's version anyway
              </Button>
            )}
          </div>
        </Message>
      )}

      {duplicate != null && (
        <Message intent="warning" title="You already have this one" data-testid="duplicate-notice">
          {duplicateMessage(duplicate.name, duplicateBy)}
        </Message>
      )}

      <Card title={recipe.name === "" ? "Untitled" : recipe.name}>
        <div className="flex flex-col gap-2">
          {recipe.description !== "" && <p className="text-sm text-fg-subtle">{recipe.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            {label !== "" && <Badge variant="soft" intent="neutral">{label}</Badge>}
            {recipe.prepMinutes !== null && <Badge variant="soft" intent="neutral">{`Prep ${recipe.prepMinutes} min`}</Badge>}
            {recipe.cookMinutes !== null && <Badge variant="soft" intent="neutral">{`Cook ${recipe.cookMinutes} min`}</Badge>}
            {recipe.image !== null && <Badge variant="outline" intent="neutral">Image</Badge>}
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="outline" intent="brand">
                {tag}
              </Badge>
            ))}
          </div>
          <Muted as="p" className="text-xs" data-source-url="">
            {imported.url}
          </Muted>
        </div>
      </Card>

      {rows.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Ingredients to review">
          <SectionTitle as="h2">Ingredients</SectionTitle>
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
        </section>
      )}

      {stepCount(recipe) > 0 && (
        <section className="flex flex-col gap-3" aria-label="Steps to review">
          <SectionTitle as="h2">Steps</SectionTitle>
          {recipe.parts
            .filter((part) => part.steps.length > 0)
            .map((part, index) => (
              <div key={`${index}-${part.name}`} className="flex flex-col gap-1" data-import-part={part.name}>
                {part.name !== "" && <span className="text-sm font-medium">{part.name}</span>}
                <ol className="flex list-decimal flex-col gap-1 pl-6">
                  {part.steps.map((step, si) => (
                    <li key={`${si}-${step.slice(0, 24)}`} className="text-sm">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </section>
      )}

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

// --- The shell -------------------------------------------------------------

export type RecipeSourceProps = {
  units: readonly Unit[];
  tags?: readonly Tag[];
  /** The chosen source, from the route's `?source`; null shows the chooser. */
  source: SourceKind | null;
  /** Choosing a source is a navigation, so the route owns it. */
  onChoose: (kind: SourceKind | null) => void;
  /** Called once with the draft the editor should open on. */
  onDraft: (draft: RecipeDraft, imageUrl: string | null) => void;
  /** Look for a recipe already imported from this address (M23.7). */
  findDuplicate?: (url: string) => Promise<{ name: string; slug: string } | null>;
  /** Look for a recipe already here under this name, for an upload (M34.3). */
  findDuplicateByName?: (name: string) => Promise<{ name: string; slug: string } | null>;
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
  /** Override the fetch (tests). */
  load?: (url: string) => Promise<ImportedRecipe>;
  /** Override the upload (tests); otherwise `postImportFile` does it. */
  loadFile?: (file: File) => Promise<ExportRecipe[]>;
  /** Whether a model is configured on the server (M34.5, M36.1); false hides the paste option and leaves every page unsorted. */
  aiAvailable?: boolean;
  /**
   * Override the AI read (tests); otherwise `importFromText` does it. The
   * anchor is the rules rung's own reading of the same page (M36.4), given for
   * a `schema` result and absent for a paste or a stub.
   */
  loadText?: ModelReader;
  /**
   * The food standing for a recipe already here under `name` (M32.3), for a
   * Tandoor export's nested recipes; null when no such recipe is here yet.
   * Overridable for tests.
   */
  linkSubRecipeFood?: (name: string) => Promise<FoodRow | null>;
};

/**
 * The food that is the recipe of this name (M32.3's "Make this a food"), when
 * that recipe is already here. A Tandoor export's nested recipe names its
 * child; if the child has been imported already, the row can point straight at
 * it. If it has not — the usual case, since an export is imported one recipe
 * at a time — this is null and the food is created plain, to be linked later.
 * A failed lookup is "not here", never a failed import.
 */
async function foodForRecipeNamed(name: string): Promise<FoodRow | null> {
  try {
    const found = await recipeByName({ data: { name } });
    if (found === null) return null;
    const doc = await getRecipe({ data: { slug: found.slug } });
    return await foodForRecipe({ data: { recipeId: doc.id } });
  } catch {
    return null;
  }
}

export function RecipeSource(props: RecipeSourceProps) {
  const { units, tags, source, onChoose, onDraft, findDuplicate, findDuplicateByName, loadFoods, load, loadFile, linkSubRecipeFood } = props;
  const { aiAvailable = false, loadText } = props;
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [choices, setChoices] = useState<ExportRecipe[] | null>(null);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientReview[]>([]);
  // Which step of the row's part owns the row, and the nested recipes the rows
  // stand for; only a Tandoor export knows either (M34.4).
  const [rowSteps, setRowSteps] = useState<number[] | null>(null);
  const [subRecipes, setSubRecipes] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<{ name: string; slug: string } | null>(null);
  // The food vocabulary the upload already fetched, so picking a recipe out of
  // a backup does not fetch it again.
  const [vocabulary, setVocabulary] = useState<readonly FoodRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The model's pass over a page (M36.6), which runs beside the review rather
  // than in front of it: `busy` would lock Create, and Create is exactly what
  // must stay available while it runs.
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const reader: ModelReader = (pageText, anchor) =>
    loadText ? loadText(pageText, anchor) : importFromText({ data: { text: pageText, sourceUrl: url, anchor } });

  /**
   * Hand a page's rules result to the model and re-render the review from what
   * comes back. The vocabulary is passed in rather than fetched again: the
   * answer's lines are the same lines in a different order, so they are
   * reviewed against the same foods the first pass used.
   */
  const readWithModel = (found: ImportedRecipe, foods: readonly FoodRow[]) => {
    if (!shouldReadWithModel(found, aiAvailable)) return;
    setReading(true);
    setReadError(null);
    void modelPass(found, reader).then((outcome) => {
      setReading(false);
      if (!outcome.ok) {
        setReadError(outcome.error);
        return;
      }
      setImported(outcome.result);
      setRows(reviewRows(ingredientLines(outcome.result.recipe), { units, foods }));
    });
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    setReadError(null);
    try {
      const [found, foods] = await Promise.all([
        load ? load(url) : importFromUrl({ data: { url } }),
        (loadFoods ?? (() => listFoods({ data: {} })))(),
      ]);
      setImported(found);
      setRows(reviewRows(ingredientLines(found.recipe), { units, foods }));
      setRowSteps(null);
      setSubRecipes([]);
      setVocabulary(foods);
      setDuplicate(findDuplicate ? await findDuplicate(found.url) : null);
      readWithModel(found, foods);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Pasted text through `claude -p` (M34.5), onto the same review. A failed
   * read — no binary, a timeout, an answer that was not a recipe — is shown
   * here and nothing is written, which is true of every rung above it too.
   */
  const readText = async () => {
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([
        loadText ? loadText(text) : importFromText({ data: { text, sourceUrl: "" } }),
        (loadFoods ?? (() => listFoods({ data: {} })))(),
      ]);
      setImported(found);
      setRows(reviewRows(ingredientLines(found.recipe), { units, foods }));
      setRowSteps(null);
      setSubRecipes([]);
      setVocabulary(foods);
      setDuplicate(findDuplicateByName ? await findDuplicateByName(found.recipe.name) : null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** One recipe out of an upload, onto the same review the URL import uses. */
  const chooseUploaded = async (recipe: ExportRecipe, foods: readonly FoodRow[]) => {
    const reviewed = isTandoorRecipe(recipe)
      ? reviewRowsFromTandoor(recipe, { units, foods })
      : { ...reviewRowsFromMealie(recipe, { units, foods }), rowSteps: null, subRecipeNames: [] as string[] };
    setImported({ from: recipe.source, url: recipe.sourceUrl, recipe, pageText: "" });
    setRows(reviewed.rows);
    setRowSteps(reviewed.rowSteps);
    setSubRecipes(reviewed.subRecipeNames);
    setDuplicate(findDuplicateByName ? await findDuplicateByName(recipe.name) : null);
  };

  const readFile = async () => {
    if (file === null) return;
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([
        (loadFile ?? postImportFile)(file),
        (loadFoods ?? (() => listFoods({ data: {} })))(),
      ]);
      if (found.length === 0) throw new Error("No recipe in that file");
      setVocabulary(foods);
      if (found.length === 1) await chooseUploaded(found[0]!, foods);
      else setChoices(found);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** Create only what the reviewer approved, then hand the draft up. */
  const create = async () => {
    if (imported === null) return;
    setBusy(true);
    setError(null);
    try {
      const pending = pendingCreations(rows);
      const createdFoods = new Map<string, FoodRow>();
      const nested = new Set(subRecipes.map((name) => name.toLowerCase()));
      for (const name of pending.foods) {
        // A row that stands for another recipe in the export gets that
        // recipe's food when the recipe is already here (M32.3); otherwise a
        // plain food, exactly as any other new name does.
        const linked = nested.has(name.toLowerCase()) ? await (linkSubRecipeFood ?? foodForRecipeNamed)(name) : null;
        createdFoods.set(name.toLowerCase(), linked ?? (await findOrCreateFood({ data: { name } })));
      }
      const createdUnits = new Map<string, Unit>();
      for (const name of pending.units) createdUnits.set(name.toLowerCase(), await findOrCreateUnit({ data: { name } }));
      const mealie = imported.from === "mealie" ? (imported.recipe as MealieRecipe) : null;

      const draft = draftFromScraped({
        scraped: imported.recipe,
        sourceUrl: imported.url,
        commits: rows.map(rowCommit),
        createdFoods,
        createdUnits,
        knownTags: tags,
        rowSteps: rowSteps ?? undefined,
        notes: mealie?.notes,
        rating: mealie?.rating ?? null,
      });
      onDraft(draft, imported.recipe.image);
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  if (source === null) return <SourceChooser disabled={busy} aiAvailable={aiAvailable} onChoose={onChoose} />;

  if (imported !== null) {
    return (
      <ImportReview
        imported={imported}
        rows={rows}
        units={units}
        searchFoods={(q) => listFoods({ data: { q } })}
        busy={busy}
        error={error}
        duplicate={duplicate}
        duplicateBy={imported.from === "schema" || imported.from === "stub" ? "url" : "name"}
        aiAvailable={aiAvailable}
        reading={reading}
        readError={readError}
        onRetryRead={() => readWithModel(imported, vocabulary)}
        onUseRejected={() => {
          const taken = withRejectedAnswer(imported);
          setImported(taken);
          setRows(reviewRows(ingredientLines(taken.recipe), { units, foods: vocabulary }));
        }}
        onRowsChange={setRows}
        onBack={() => {
          setImported(null);
          setRowSteps(null);
          setSubRecipes([]);
          setDuplicate(null);
          setError(null);
          setReading(false);
          setReadError(null);
        }}
        onCreate={() => void create()}
      />
    );
  }

  if (choices !== null) {
    return (
      <RecipePicker
        recipes={choices}
        busy={busy}
        onPick={(index) => {
          const recipe = choices[index];
          if (recipe) void chooseUploaded(recipe, vocabulary);
        }}
        onBack={() => {
          setChoices(null);
          setError(null);
        }}
      />
    );
  }

  if (source === "paste") {
    return (
      <PasteSource
        text={text}
        busy={busy}
        error={error}
        onTextChange={(next) => {
          setText(next);
          setError(null);
        }}
        onRead={() => void readText()}
        onBack={() => {
          setError(null);
          onChoose(null);
        }}
      />
    );
  }

  if (source === "file") {
    return (
      <FileSource
        file={file}
        busy={busy}
        error={error}
        onFileChange={(next) => {
          setFile(next);
          setError(null);
        }}
        onRead={() => void readFile()}
        onBack={() => {
          setError(null);
          onChoose(null);
        }}
      />
    );
  }

  return (
    <UrlSource
      url={url}
      busy={busy}
      error={error}
      onUrlChange={setUrl}
      onFetch={() => void read()}
      onBack={() => {
        setError(null);
        onChoose(null);
      }}
    />
  );
}
