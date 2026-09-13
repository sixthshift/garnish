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
//   file     a Mealie export — a backup zip or one recipe's JSON — read by
//            `importMealie` (M34.3). A zip holding several recipes asks which
//            one first. It lands on the same review as a scraped page, with
//            its parts already made from Mealie's section titles.
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
import { type FormEvent, useState } from "react";
import type { Food as FoodRow } from "../db/models/food/repo";
import { pendingCreations, reviewRows, type RowCommit, rowCommit } from "../domain/bulkIngredients";
import { type MealieRecipe, reviewRowsFromMealie } from "../domain/importMealie";
import type { Tag, Unit } from "../domain/recipe";
import type { ScrapedRecipe } from "../domain/schemaRecipe";
import { suggestLinks } from "../domain/stepIngredients";
import { randomUuid } from "../lib/ids";
import { postImportFile } from "../lib/importFile";
import { messageFrom } from "../lib/notify";
import { findOrCreateFood, listFoods } from "../server/foods";
import type { ImportedRecipe, ImportSource } from "../server/recipeImport";
import { importFromUrl } from "../server/recipeImport";
import { findOrCreateUnit } from "../server/units";
import { IngredientReviewRow, type IngredientReview } from "./IngredientReviewRow";
import { filterUnits, reviewedIngredient } from "./IngredientsEditor";
import { emptyDraft, type DraftPart, type RecipeDraft, tagsFromNames } from "./RecipeForm";
import { newStep } from "./StepsEditor";

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

/** Which source the chooser is on. */
export type SourceKind = "url" | "manual" | "file";

/**
 * A scraped recipe and its reviewed ingredient lines as a draft. Steps keep
 * the parts the page described (decisions.md row 59); the ingredients go on
 * the unnamed main body, one being added at the front when the page was all
 * named sections, because schema.org cannot say which section an ingredient
 * belongs to. Each part then runs through `suggestLinks` (M28.2), so the
 * draft arrives with its step-ingredient links already filled for review.
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
   * Which part each commit belongs to, by index into `scraped.parts` (M34.3).
   * A source that knows — Mealie's ingredient sections — says so; a scraped
   * page cannot, and leaves this out to put every row on the main body.
   */
  rowParts?: readonly number[];
  /** Notes the source carried (Mealie's `notes`). */
  notes?: readonly { title: string; text: string }[];
  /** A rating the source carried, 1 to 5. */
  rating?: number | null;
}): RecipeDraft {
  const { scraped, sourceUrl, commits, createdFoods, createdUnits, knownTags = [], rowParts, notes = [], rating = null } = opts;
  const rows = commits.map((commit) => reviewedIngredient(commit, createdFoods, createdUnits));

  const parts: DraftPart[] = scraped.parts.map((part) => ({
    id: randomUuid(),
    name: part.name,
    ingredients: [],
    steps: part.steps.map((step) => newStep(step)),
  }));
  if (rowParts !== undefined) {
    rows.forEach((row, index) => {
      const part = parts[rowParts[index] ?? 0];
      if (part) part.ingredients.push(row);
    });
  } else {
    const main = parts.findIndex((part) => (part.name ?? "") === "");
    if (main >= 0) parts[main]!.ingredients = rows;
    else if (rows.length > 0) parts.unshift({ id: randomUuid(), name: "", ingredients: rows, steps: [] });
  }

  const linked = parts.map(withSuggestedLinks);

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

/** How many steps came back across every part. Pure. */
export function stepCount(scraped: ScrapedRecipe): number {
  return scraped.parts.reduce((total, part) => total + part.steps.length, 0);
}

/** What the review says it got, and how. Pure. */
export function importSummary(from: ImportSource, ingredients: number, steps: number): string {
  if (from === "stub") return "That page has no recipe data, so this is just its title and picture. The rest is yours to type in.";
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return `Read ${count(ingredients, "ingredient")} and ${count(steps, "step")}. Nothing is saved yet, and no food or unit is created unless you ask for it below.`;
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
};

/** The first stage: the three ways a recipe gets here. */
export function SourceChooser({ onChoose, disabled }: SourceChooserProps) {
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
 * The second stage for an export: one file. A Mealie backup zip, or one
 * recipe's JSON. Tandoor's own export is named on the button because it is the
 * other thing people arrive with; M34.4 is what reads it.
 */
export function FileSource({ file, busy, error, onFileChange, onRead, onBack }: FileSourceProps) {
  const inputId = "import-file";
  return (
    <div className="flex flex-col gap-4" data-source-stage="file">
      <SectionTitle as="h2">From a Mealie or Tandoor export</SectionTitle>
      <Muted as="p" className="text-sm">
        A Mealie backup <code>.zip</code>, or a single recipe saved as JSON. Nothing is saved until you have looked at it.
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
          aria-label="Mealie export"
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
  recipes: readonly MealieRecipe[];
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
                {`${recipe.ingredients.length} ingredients, ${stepCount(recipe)} steps`}
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
  /** A recipe already here with the same source (M23.7) or the same name (M34.3). */
  duplicate?: { name: string; slug: string } | null;
  /** Which of the two the duplicate was found by; the address, by default. */
  duplicateBy?: DuplicateBy;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onCreate: () => void;
};

/** The third stage: what the page gave up, before any of it is written. */
export function ImportReview(props: ImportReviewProps) {
  const { imported, rows, units, searchFoods, busy, error, duplicate, duplicateBy = "url", onRowsChange, onBack, onCreate } = props;
  const { recipe, from } = imported;
  const label = yieldLabel(recipe);

  return (
    <div className="flex flex-col gap-6" data-source-stage="review" data-import-from={from}>
      {from === "stub" ? (
        <Message intent="warning" title="No recipe data on that page" data-testid="stub-notice">
          {importSummary(from, 0, 0)}
        </Message>
      ) : (
        <Muted as="p" className="text-sm">
          {importSummary(from, recipe.ingredients.length, stepCount(recipe))}
        </Muted>
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
  loadFile?: (file: File) => Promise<MealieRecipe[]>;
};

export function RecipeSource(props: RecipeSourceProps) {
  const { units, tags, source, onChoose, onDraft, findDuplicate, findDuplicateByName, loadFoods, load, loadFile } = props;
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [choices, setChoices] = useState<MealieRecipe[] | null>(null);
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientReview[]>([]);
  // Which part each row belongs to; only an upload knows (M34.3).
  const [rowParts, setRowParts] = useState<number[] | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; slug: string } | null>(null);
  // The food vocabulary the upload already fetched, so picking a recipe out of
  // a backup does not fetch it again.
  const [vocabulary, setVocabulary] = useState<readonly FoodRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const [found, foods] = await Promise.all([
        load ? load(url) : importFromUrl({ data: { url } }),
        (loadFoods ?? (() => listFoods({ data: {} })))(),
      ]);
      setImported(found);
      setRows(reviewRows(found.recipe.ingredients, { units, foods }));
      setRowParts(null);
      setDuplicate(findDuplicate ? await findDuplicate(found.url) : null);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  /** One recipe out of an upload, onto the same review the URL import uses. */
  const chooseMealie = async (recipe: MealieRecipe, foods: readonly FoodRow[]) => {
    const reviewed = reviewRowsFromMealie(recipe, { units, foods });
    setImported({ from: "mealie", url: recipe.sourceUrl, recipe });
    setRows(reviewed.rows);
    setRowParts(reviewed.rowParts);
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
      if (found.length === 1) await chooseMealie(found[0]!, foods);
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
      for (const name of pending.foods) createdFoods.set(name.toLowerCase(), await findOrCreateFood({ data: { name } }));
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
        rowParts: rowParts ?? undefined,
        notes: mealie?.notes,
        rating: mealie?.rating ?? null,
      });
      onDraft(draft, imported.recipe.image);
    } catch (cause) {
      setBusy(false);
      setError(messageFrom(cause));
    }
  };

  if (source === null) return <SourceChooser disabled={busy} onChoose={onChoose} />;

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
        duplicateBy={imported.from === "mealie" ? "name" : "url"}
        onRowsChange={setRows}
        onBack={() => {
          setImported(null);
          setRowParts(null);
          setDuplicate(null);
          setError(null);
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
          if (recipe) void chooseMealie(recipe, vocabulary);
        }}
        onBack={() => {
          setChoices(null);
          setError(null);
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
