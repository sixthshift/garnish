// The import's read as the draft Check opens on (decisions.md row 203): every
// line the library already knows is linked, a food or unit the source named and
// the library lacks is a placeholder the save creates by name, and a line the
// parse could not settle stays as its raw text, waiting on the household.

import { randomUuid } from "../../../lib/id";
import { review, type ScrapedRecipe } from "../import";
import { pendingCreations, type RowCommit, rowCommit, rowStatus } from "../ingredient";
import type { FoodRow, Tag, Unit } from "../reference";
import { type IngredientReview, parsedRowPatch } from "./review";
import { draftFromScraped } from "./scraped";
import type { DraftIngredient, RecipeDraft } from "./types";
import { unitReference } from "./vocabulary";

/** The lines Check still asks about, by the draft row's id: the parse that named what the library lacks. */
export type PendingLines = Readonly<Record<string, IngredientReview>>;

/**
 * A food that exists only by name. The recipe repository finds or creates a
 * food by name when the recipe is saved (`resolveFood`), so a placeholder
 * costs nothing until then and a cancelled import leaves nothing behind. Pure
 * apart from its id.
 */
export function placeholderFood(name: string): FoodRow {
  return { id: randomUuid(), name: name.trim(), pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
}

/**
 * The placeholders every `create` among `rows` needs, keyed by lowercased name
 * as `reviewedIngredient` reads them. `linked` names a food that already
 * stands for a recipe here (a Tandoor export's nested recipe), used in place
 * of a placeholder. Pure apart from the ids.
 */
export function placeholders(
  rows: readonly IngredientReview[],
  linked: ReadonlyMap<string, FoodRow> = new Map()
): { foods: Map<string, FoodRow>; units: Map<string, Unit> } {
  const pending = pendingCreations(rows);
  const foods = new Map<string, FoodRow>();
  for (const name of pending.foods) foods.set(name.toLowerCase(), linked.get(name.toLowerCase()) ?? placeholderFood(name));
  const units = new Map<string, Unit>();
  for (const name of pending.units) units.set(name.toLowerCase(), unitReference(name));
  return { foods, units };
}

/** A line committed as its raw text, whatever the parse made of it. Pure. */
function asText(row: IngredientReview): RowCommit<Unit, FoodRow> {
  return { textOnly: true, originalText: row.originalText, quantity: null, fixed: false, note: "", unit: null, food: null };
}

export type ImportDraftOptions = {
  scraped: ScrapedRecipe;
  sourceUrl: string;
  /** The scraped lines read against the library, in part order. */
  rows: readonly IngredientReview[];
  knownTags?: readonly Tag[];
  /** Which step of its part each row was written under; only a Tandoor export knows. */
  rowSteps?: readonly number[] | null;
  /** Foods standing for recipes already here, by lowercased name. */
  linked?: ReadonlyMap<string, FoodRow>;
  notes?: readonly { title: string; text: string }[];
  rating?: number | null;
};

/**
 * The draft Check opens on, and the lines it still asks about. A row the parse
 * settled goes in linked, with a placeholder for a food or unit an export
 * names and the library lacks; a row the parse left undecided (a food or a
 * unit named and not found) goes in as its raw text and is listed under its
 * draft id, so Check can offer Add, Pick or Text. Pure apart from the ids.
 */
export function importDraft(options: ImportDraftOptions): { draft: RecipeDraft; pending: PendingLines } {
  const { scraped, sourceUrl, rows, knownTags = [], rowSteps = null, linked, notes, rating } = options;
  const undecided = rows.map((row) => rowStatus(row) === "review");
  const made = placeholders(
    rows.filter((_, index) => !undecided[index]),
    linked
  );
  const commits = rows.map((row, index) => (undecided[index] ? asText(row) : rowCommit(row)));
  const draft = draftFromScraped({
    scraped,
    sourceUrl,
    commits,
    createdFoods: made.foods,
    createdUnits: made.units,
    knownTags,
    rowSteps: rowSteps ?? undefined,
    notes,
    rating,
  });
  // The draft's rows are the review's rows in the same order, part after part.
  const ids = draft.parts.flatMap((part) => part.ingredients.map((row) => row.id ?? ""));
  const pending: Record<string, IngredientReview> = {};
  rows.forEach((row, index) => {
    const id = ids[index];
    if (undecided[index] && id) pending[id] = row;
  });
  return { draft, pending };
}

/** What Check says a pending line names: the food the library lacks, or the unit when the food matched. Pure. */
export function pendingLabel(row: IngredientReview): string {
  if (row.food.kind === "none") return `New food: ${row.foodText}`;
  return `New unit: ${row.unitText}`;
}

/**
 * Add on a pending line: everything the parse proposed is taken, a missing
 * food or unit as a placeholder the save creates. Pure apart from the ids.
 */
export function addedAsNew(row: IngredientReview): Partial<DraftIngredient> | null {
  const accepted = review.acceptProposals(row);
  const made = placeholders([accepted]);
  return parsedRowPatch(accepted, made.foods, made.units);
}

/** The draft with the row whose id is `id` patched, wherever it is. Unchanged when no row has that id. Pure. */
export function withIngredientPatched(draft: RecipeDraft, id: string, patch: Partial<DraftIngredient>): RecipeDraft {
  if (!draft.parts.some((part) => part.ingredients.some((row) => row.id === id))) return draft;
  return {
    ...draft,
    parts: draft.parts.map((part) => ({ ...part, ingredients: part.ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row)) })),
  };
}

/** The pending lines still in the draft: a line removed while Check was open is no longer asked about. Pure. */
export function livePending(draft: RecipeDraft, pending: PendingLines): PendingLines {
  const ids = new Set(draft.parts.flatMap((part) => part.ingredients.map((row) => row.id ?? "")));
  return Object.fromEntries(Object.entries(pending).filter(([id]) => ids.has(id)));
}

/** "17 linked · 2 need a food": the ingredient lines as Check counts them, the empty counts left out. Pure. */
export function checkStatus(draft: RecipeDraft, pending: PendingLines): string {
  const rows = draft.parts.flatMap((part) => part.ingredients);
  const linked = rows.filter((row) => row.food).length;
  const asking = Object.keys(livePending(draft, pending)).length;
  const clauses = [linked > 0 ? `${linked} linked` : "", asking > 0 ? `${asking} ${asking === 1 ? "needs" : "need"} a food` : ""].filter(
    (clause) => clause !== ""
  );
  return clauses.join(" · ");
}
