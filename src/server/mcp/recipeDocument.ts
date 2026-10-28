// The recipe as a model reads and writes it over MCP, and the conversion to and from garnish's own document.
//
// garnish's document nests every food, unit and tag as a full row with an id, which is right for the
// editor and wrong for a model: it would have to look up ids it cannot see and copy rows it should not
// touch. So the model writes an ingredient the way a person types one — "200 g spring onions, thinly
// sliced" — and garnish's own parser, the one behind the editor's Parse all, reads it against the
// household's units and foods. Ids appear only so an edit can say which row it means.
import { z } from "zod";
import { foodReference, tagsFromNames } from "../../domain/draft";
import { formatIngredient, parseIngredient } from "../../domain/ingredient";
import { type Ingredient, type Recipe, type RecipeInput, type RecipeKind, recipeInputSchema, recipeKindSchema, suggestLinks } from "../../domain/recipe";
import type { FoodRow, Tag, Unit } from "../../domain/reference";

/** What the household already has: the parser matches against it, and a write reuses it before making anything. */
export type Vocabulary = { units: readonly Unit[]; foods: readonly FoodRow[]; tags: readonly Tag[] };

/** A food name longer than this is a description, not a food: the line is kept as text instead of becoming one. */
export const MAX_NEW_FOOD_WORDS = 4;

// --- What the model sends ------------------------------------------------

const text = z.string().trim();
const minutes = z.number().int().nonnegative().nullable();

const ingredientInput = z.union([
  text.min(1),
  z.object({ id: z.uuid().optional().describe("Keep an existing ingredient: its id from get_recipe"), text: text.min(1) }),
]);

const stepInput = z.union([
  text.min(1),
  z.object({
    id: z.uuid().optional().describe("Keep an existing step (and its photo): its id from get_recipe"),
    title: z.string().optional().describe("Two to four words naming what the step achieves; usually empty"),
    text: text.min(1),
    summary: z.string().optional().describe("Why, what to expect, or what to do if it goes wrong; not an instruction"),
  }),
]);

export const partInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().default("").describe("'' for the recipe's main body; a name like 'Sauce' or 'To serve' for a component"),
  ingredients: z.array(ingredientInput).default([]).describe('One line each, as a person types it: "200 g spring onions, thinly sliced"'),
  steps: z.array(stepInput).default([]),
});

const noteInput = z.object({ id: z.uuid().optional(), title: z.string().default(""), text: text.min(1) });

/** A recipe's fields as the model sets them. Every one is optional on an update, where what is left out stays as it is. */
export const recipeFieldsSchema = {
  name: text.min(1).describe("The recipe's name"),
  description: z.string().describe("One or two sentences"),
  servings: z.number().nonnegative().describe("How many it serves; 0 when it is not a serving count"),
  yield: z.string().describe("What it makes, when servings does not say it: '24 biscuits'"),
  prepMinutes: minutes,
  cookMinutes: minutes,
  sourceUrl: z.string().nullable().describe("Where the recipe came from"),
  tags: z.array(text.min(1)).describe("Tag names; existing tags are reused"),
  favourite: z.boolean(),
  kind: recipeKindSchema
    .nullable()
    .describe("How the household cooks it: 'rotation' for a weeknight regular, 'weekend' for one worth a weekend's time, null when not said"),
  rating: z.number().min(0).max(5).nullable(),
  parts: z.array(partInputSchema).min(1).describe("At least one; the first is usually the unnamed main body"),
  notes: z.array(noteInput).describe("The recipe's notes, in order"),
};

export const createRecipeSchema = z.object(recipeFieldsSchema).partial().required({ name: true, parts: true });
export const updateRecipeSchema = z.object(recipeFieldsSchema).partial();
export type McpRecipeInput = z.input<typeof updateRecipeSchema>;

// --- What the model reads ------------------------------------------------

/** The recipe as `get_recipe` answers it. */
export type McpRecipe = {
  id: string;
  slug: string;
  name: string;
  description: string;
  servings: number;
  yield: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  sourceUrl: string | null;
  tags: string[];
  favourite: boolean;
  kind: RecipeKind | null;
  rating: number | null;
  lastMade: string | null;
  parts: {
    id: string;
    name: string;
    ingredients: { id: string; text: string; food: string | null }[];
    steps: { id: string; title: string; text: string; summary: string; uses: string[]; hasPhoto: boolean }[];
  }[];
  notes: { id: string; title: string; text: string }[];
};

/** One ingredient as a line, the way the recipe page shows it. Pure. */
export const ingredientLine = (ingredient: Ingredient): string => formatIngredient(ingredient);

/** garnish's document as the model reads it. Pure. */
export function recipeForMcp(doc: Recipe): McpRecipe {
  return {
    id: doc.id,
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    servings: doc.recipeServings,
    yield: doc.recipeYield,
    prepMinutes: doc.prepTime,
    cookMinutes: doc.performTime,
    sourceUrl: doc.sourceUrl,
    tags: doc.tags.map((tag) => tag.name),
    favourite: doc.favourite,
    kind: doc.kind,
    rating: doc.rating,
    lastMade: doc.lastMade,
    parts: doc.parts.map((part) => ({
      id: part.id,
      name: part.name,
      ingredients: part.ingredients.map((ingredient) => ({ id: ingredient.id, text: ingredientLine(ingredient), food: ingredient.food?.name ?? null })),
      steps: part.steps.map((step) => ({
        id: step.id,
        title: step.title,
        text: step.text,
        summary: step.summary,
        uses: step.ingredientIds,
        hasPhoto: step.image !== null,
      })),
    })),
    notes: doc.notes.map((note) => ({ id: note.id, title: note.title, text: note.text })),
  };
}

// --- The model's input to garnish's document --------------------------------

/** What a write made along the way, for the tool's answer: so the model, and through it the person, can see it. */
export type WriteReport = {
  /** Foods the write added to the household's list. */
  createdFoods: string[];
  /** Lines kept as plain text, with no food: no food matched and the rest was too long to be one. */
  textOnly: string[];
};

/**
 * The model's recipe as garnish's write document, over `current` when it is an
 * edit. A field left out keeps `current`'s value; `parts`, when given,
 * replaces every part. An ingredient or step that names an id from `current`
 * and has not changed keeps its row whole — its food, its links, its photo —
 * and anything new or changed is parsed afresh. New foods are made only for a
 * short unmatched name (MAX_NEW_FOOD_WORDS); a longer one stays a text line.
 * Steps with no links get them from `suggestLinks`, as an import's do. Pure
 * apart from the random ids it gives new rows.
 */
export function documentFromMcp(
  input: z.output<typeof updateRecipeSchema>,
  vocabulary: Vocabulary,
  current: Recipe | null
): { doc: RecipeInput; report: WriteReport } {
  const report: WriteReport = { createdFoods: [], textOnly: [] };
  /** New foods by lower-cased name, so two lines of one new food make one food. */
  const made = new Map<string, ReturnType<typeof foodReference>>();
  const currentIngredients = new Map(current?.parts.flatMap((part) => part.ingredients.map((row) => [row.id, row] as const)) ?? []);
  const currentSteps = new Map(current?.parts.flatMap((part) => part.steps.map((row) => [row.id, row] as const)) ?? []);

  function ingredientFrom(entry: z.output<typeof partInputSchema>["ingredients"][number]): Ingredient {
    const line = typeof entry === "string" ? entry : entry.text;
    const keep = typeof entry === "string" || !entry.id ? undefined : currentIngredients.get(entry.id);
    if (keep && ingredientLine(keep) === line) return keep;

    const parsed = parseIngredient(line, vocabulary);
    const id = keep?.id ?? crypto.randomUUID();
    const base = { id, quantity: parsed.quantity, unit: parsed.unit, note: parsed.note, originalText: line, fixed: parsed.fixed };
    if (parsed.food) return { ...base, food: foodReference(parsed.food) };

    const name = parsed.foodText.trim();
    const words = name.split(/\s+/).filter(Boolean).length;
    if (words === 0 || words > MAX_NEW_FOOD_WORDS) {
      report.textOnly.push(line);
      return { ...base, quantity: null, unit: null, note: "", food: null };
    }
    const key = name.toLowerCase();
    let food = made.get(key);
    if (!food) {
      food = foodReference({ name });
      made.set(key, food);
      report.createdFoods.push(name);
    }
    return { ...base, food };
  }

  function partFrom(part: z.output<typeof partInputSchema>) {
    const ingredients = part.ingredients.map(ingredientFrom);
    const kept = new Set(ingredients.map((row) => row.id));
    const steps = part.steps.map((entry) => {
      const fields = typeof entry === "string" ? { text: entry } : entry;
      const before = "id" in fields && fields.id ? currentSteps.get(fields.id) : undefined;
      const unchanged = before !== undefined && before.text === fields.text;
      return {
        id: before?.id ?? crypto.randomUUID(),
        title: "title" in fields && fields.title !== undefined ? fields.title : (before?.title ?? ""),
        text: fields.text,
        summary: "summary" in fields && fields.summary !== undefined ? fields.summary : (before?.summary ?? ""),
        ingredientIds: unchanged ? before.ingredientIds.filter((id) => kept.has(id)) : [],
        image: before?.image ?? null,
      };
    });
    return {
      id: part.id && current?.parts.some((p) => p.id === part.id) ? part.id : undefined,
      name: part.name.trim(),
      ingredients,
      steps: suggestLinks({ ingredients, steps }),
    };
  }

  const pick = <K extends keyof typeof input, T>(key: K, fallback: T): NonNullable<(typeof input)[K]> | T =>
    input[key] !== undefined ? input[key]! : fallback;

  const doc: RecipeInput = {
    name: pick("name", current?.name ?? ""),
    description: pick("description", current?.description ?? ""),
    image: current?.image ?? null,
    rating: input.rating !== undefined ? (input.rating === 0 ? null : input.rating) : (current?.rating ?? null),
    lastMade: current?.lastMade ?? null,
    recipeServings: pick("servings", current?.recipeServings ?? 0),
    recipeYieldQuantity: current?.recipeYieldQuantity ?? 0,
    yieldUnit: current?.yieldUnit ?? null,
    recipeYield: pick("yield", current?.recipeYield ?? ""),
    prepTime: input.prepMinutes !== undefined ? input.prepMinutes : (current?.prepTime ?? null),
    performTime: input.cookMinutes !== undefined ? input.cookMinutes : (current?.performTime ?? null),
    sourceUrl: input.sourceUrl !== undefined ? input.sourceUrl : (current?.sourceUrl ?? null),
    favourite: pick("favourite", current?.favourite ?? false),
    kind: input.kind !== undefined ? input.kind : (current?.kind ?? null),
    tags: input.tags !== undefined ? tagsFromNames(input.tags, vocabulary.tags) : (current?.tags ?? []),
    notes: input.notes !== undefined ? input.notes.map((note) => ({ id: note.id, title: note.title, text: note.text })) : (current?.notes ?? []),
    parts: input.parts !== undefined ? input.parts.map(partFrom) : (current?.parts ?? []),
  };
  return { doc, report };
}

/** `documentFromMcp`'s document checked by the same schema the editor's saves are. Throws a readable error. */
export function parseDocument(doc: RecipeInput) {
  const parsed = recipeInputSchema.safeParse(doc);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "recipe"}: ${issue.message}`).join("; "));
  return parsed.data;
}
