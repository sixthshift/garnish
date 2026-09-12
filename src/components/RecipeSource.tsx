// The first question about a new recipe: where is it from? (M23.6,
// decisions.md row 57.)
//
// Three stages behind one route:
//
//   choose   a web page, or your own.
//   url      a URL, fetched through `importFromUrl` (M23.5). What comes back
//            is either a schema.org recipe or an OpenGraph stub, and the
//            review says which — a stub has a name and a picture and nothing
//            else, and pretending otherwise would waste your time.
//   review   the fields as chips, the ingredient lines through
//            `parseIngredient` and the M17.5 review rows, the steps as a
//            numbered list per part. Create builds the draft, fills
//            `sourceUrl`, and creates only the foods and units approved here.
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
import type { Tag, Unit } from "../domain/recipe";
import type { ScrapedRecipe } from "../domain/schemaRecipe";
import { suggestLinks } from "../domain/stepIngredients";
import { randomUuid } from "../lib/ids";
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
export type SourceKind = "url" | "manual";

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
}): RecipeDraft {
  const { scraped, sourceUrl, commits, createdFoods, createdUnits, knownTags = [] } = opts;
  const rows = commits.map((commit) => reviewedIngredient(commit, createdFoods, createdUnits));

  const parts: DraftPart[] = scraped.parts.map((part) => ({
    id: randomUuid(),
    name: part.name,
    ingredients: [],
    steps: part.steps.map((step) => newStep(step)),
  }));
  const main = parts.findIndex((part) => (part.name ?? "") === "");
  if (main >= 0) parts[main]!.ingredients = rows;
  else if (rows.length > 0) parts.unshift({ id: randomUuid(), name: "", ingredients: rows, steps: [] });

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

// --- Stages ----------------------------------------------------------------

export type SourceChooserProps = {
  onChoose: (kind: SourceKind) => void;
  disabled?: boolean;
};

/** The first stage: two ways a recipe gets here. */
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

export type ImportReviewProps = {
  imported: ImportedRecipe;
  rows: readonly IngredientReview[];
  units: readonly Unit[];
  searchFoods: (q: string) => Promise<FoodRow[]>;
  busy?: boolean;
  error?: string | null;
  /** A recipe already here with the same source (M23.7). */
  duplicate?: { name: string; slug: string } | null;
  onRowsChange: (rows: IngredientReview[]) => void;
  onBack: () => void;
  onCreate: () => void;
};

/** The third stage: what the page gave up, before any of it is written. */
export function ImportReview(props: ImportReviewProps) {
  const { imported, rows, units, searchFoods, busy, error, duplicate, onRowsChange, onBack, onCreate } = props;
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
          {`“${duplicate.name}” was imported from the same address. Creating this makes a second copy.`}
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
  /** Override the food vocabulary (tests); otherwise `listFoods` supplies it. */
  loadFoods?: () => Promise<FoodRow[]>;
  /** Override the fetch (tests). */
  load?: (url: string) => Promise<ImportedRecipe>;
};

export function RecipeSource({ units, tags, source, onChoose, onDraft, findDuplicate, loadFoods, load }: RecipeSourceProps) {
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<ImportedRecipe | null>(null);
  const [rows, setRows] = useState<IngredientReview[]>([]);
  const [duplicate, setDuplicate] = useState<{ name: string; slug: string } | null>(null);
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
      setDuplicate(findDuplicate ? await findDuplicate(found.url) : null);
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
      const draft = draftFromScraped({
        scraped: imported.recipe,
        sourceUrl: imported.url,
        commits: rows.map(rowCommit),
        createdFoods,
        createdUnits,
        knownTags: tags,
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
        onRowsChange={setRows}
        onBack={() => {
          setImported(null);
          setDuplicate(null);
          setError(null);
        }}
        onCreate={() => void create()}
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
