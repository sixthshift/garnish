// M27.5: quick edit from the recipe page. The two sheet bodies render on their
// own (the Sheet shell only paints once mounted on a client), so they are what
// these exercise, alongside the pure helpers that build the document a save
// writes — the stored one, with exactly one row changed and every id kept, so
// the session's ticks survive.
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type DraftIngredient, withIngredientReplaced, withStepReplaced } from "../../../../../src/domain/draft";
import type { Ingredient, Recipe } from "../../../../../src/domain/recipe";
import type { Unit } from "../../../../../src/domain/reference";
import { getTicks, type StorageLike, setIngredientTicked, setStepTicked } from "../../../../../src/lib/ticks";
import { QuickEditIngredientBody } from "../../../../../src/routes/recipes/recipe/components/QuickEditIngredient";
import { QuickEditStepBody } from "../../../../../src/routes/recipes/recipe/components/QuickEditStep";
import { saveQuickEdit } from "../../../../../src/routes/recipes/recipe/components/saveQuickEdit";

// `updateRecipe` is the only server call a save makes; the test keeps what it
// was sent so it can be compared with the stored document.
const sent = vi.hoisted(() => [] as Array<{ data: { id: string; doc: unknown } }>);
vi.mock("../../../../../src/server/fns/recipes", () => ({
  updateRecipe: (args: { data: { id: string; doc: unknown } }) => {
    sent.push(args);
    return Promise.resolve({});
  },
}));
// The sheets query these on open / while typing; nothing here opens one.
vi.mock("../../../../../src/server/fns/units", () => ({ listUnits: () => Promise.resolve([]) }));
vi.mock("../../../../../src/server/fns/foods", () => ({ listFoods: () => Promise.resolve([]) }));

const flour = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const sugar = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "sugar",
  pluralName: null,
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const ingredient = (id: string, food: typeof flour, quantity: number): Ingredient => ({
  id,
  quantity,
  unit: gram,
  food,
  note: "",
  originalText: "",
  fixed: false,
});

const PASTRY = "22222222-2222-4222-8222-222222222221";
const FILLING = "22222222-2222-4222-8222-222222222222";
const PASTRY_FLOUR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const FILLING_SUGAR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const PASTRY_STEP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const FILLING_STEP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

const stored: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  notes: [],
  tags: [],
  parts: [
    {
      id: PASTRY,
      name: "Pastry",
      ingredients: [ingredient(PASTRY_FLOUR, flour, 200)],
      steps: [{ id: PASTRY_STEP, text: "Rub the butter in", ingredientIds: [], image: null }],
    },
    {
      id: FILLING,
      name: "Filling",
      ingredients: [ingredient(FILLING_SUGAR, sugar, 100)],
      steps: [{ id: FILLING_STEP, text: "Whisk **well**", ingredientIds: [], image: null }],
    },
  ],
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-03-04T02:30:00.000Z",
};

/** Every id in a document, in order: what a quick edit must leave alone. */
function idsOf(doc: {
  parts: ReadonlyArray<{ id?: string; ingredients: ReadonlyArray<{ id?: string }>; steps: ReadonlyArray<{ id?: string }> }>;
}): Array<string | undefined> {
  return doc.parts.flatMap((part) => [part.id, ...part.ingredients.map((row) => row.id), ...part.steps.map((row) => row.id)]);
}

describe("withIngredientReplaced", () => {
  test("replaces exactly the named row and leaves every other one alone", () => {
    const next: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, quantity: 250, note: "plain" };
    const draft = withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, next);

    expect(draft.parts[0]!.ingredients[0]!.quantity).toBe(250);
    expect(draft.parts[0]!.ingredients[0]!.note).toBe("plain");
    expect(draft.parts[1]!.ingredients[0]).toEqual(stored.parts[1]!.ingredients[0]);
    expect(draft.parts[0]!.steps).toEqual(stored.parts[0]!.steps);
    expect(draft.name).toBe("Lemon tart");
  });

  test("keeps every id, so the session's ticks still find their rows", () => {
    const next: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, quantity: 250 };
    expect(idsOf(withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, next))).toEqual(idsOf(stored));
  });

  test("the row's own id wins over anything the replacement carries", () => {
    const next: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, id: "99999999-9999-4999-8999-999999999999" };
    expect(withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, next).parts[0]!.ingredients[0]!.id).toBe(PASTRY_FLOUR);
  });

  test("an unknown part or row changes nothing", () => {
    const next: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, quantity: 250 };
    expect(withIngredientReplaced(stored, FILLING, PASTRY_FLOUR, next).parts).toEqual(withIngredientReplaced(stored, PASTRY, "nope", next).parts);
    expect(withIngredientReplaced(stored, "nope", PASTRY_FLOUR, next).parts[0]!.ingredients[0]!.quantity).toBe(200);
  });
});

describe("withStepReplaced", () => {
  test("replaces one step's text, keeping its place and every id", () => {
    const draft = withStepReplaced(stored, FILLING, FILLING_STEP, "Whisk until pale");

    expect(draft.parts[1]!.steps[0]!.text).toBe("Whisk until pale");
    expect(draft.parts[0]!.steps[0]!.text).toBe("Rub the butter in");
    expect(draft.parts[1]!.ingredients).toEqual(stored.parts[1]!.ingredients);
    expect(idsOf(draft)).toEqual(idsOf(stored));
  });

  test("an unknown part or step changes nothing", () => {
    expect(withStepReplaced(stored, PASTRY, FILLING_STEP, "x").parts[1]!.steps[0]!.text).toBe("Whisk **well**");
    expect(withStepReplaced(stored, "nope", FILLING_STEP, "x").parts[1]!.steps[0]!.text).toBe("Whisk **well**");
  });
});

/** An in-memory sessionStorage, so the ticks a test seeds are readable back. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

describe("saveQuickEdit", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  test("sends the whole stored document with only that row changed", async () => {
    let invalidated = 0;
    const run = async <T,>(write: () => Promise<T>) => {
      const result = await write();
      invalidated += 1;
      return result;
    };

    const next: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, quantity: 250 };
    await saveQuickEdit(withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, next), run);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.data.id).toBe(stored.id);
    // The document as stored, but for the one amount: parts, steps, ids and
    // the recipe's own fields all come back through untouched.
    const doc = sent[0]!.data.doc as Recipe;
    expect(doc.parts[0]!.ingredients[0]!.quantity).toBe(250);
    // `restyledAt` is read-only, so the document sent does not carry it (M37.5).
    expect({ ...doc, parts: undefined }).toEqual({
      ...withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, next),
      parts: undefined,
      restyledAt: undefined,
    });
    expect(idsOf(doc)).toEqual(idsOf(stored));
    expect(doc.parts[1]).toEqual(stored.parts[1]);
    expect(doc.parts[0]!.steps).toEqual(stored.parts[0]!.steps);
    expect(invalidated).toBe(1);
  });

  test("the ticks for the recipe are untouched by a save", async () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, stored.id, PASTRY_FLOUR, true);
    setStepTicked(storage, stored.id, FILLING_STEP, true);
    const before = getTicks(storage, stored.id);

    await saveQuickEdit(withStepReplaced(stored, FILLING, FILLING_STEP, "Whisk until pale"), (write) => write());

    expect(getTicks(storage, stored.id)).toEqual(before);
    // And the ticked ids are still in the document that was sent.
    const doc = sent[0]!.data.doc as Recipe;
    expect(doc.parts[0]!.ingredients[0]!.id).toBe(PASTRY_FLOUR);
    expect(doc.parts[1]!.steps[0]!.id).toBe(FILLING_STEP);
  });

  test("a document that does not validate is refused before anything is written", async () => {
    const blank: DraftIngredient = { ...stored.parts[0]!.ingredients[0]!, quantity: -1 };
    await expect(saveQuickEdit(withIngredientReplaced(stored, PASTRY, PASTRY_FLOUR, blank), (write) => write())).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("QuickEditIngredientBody", () => {
  const row: DraftIngredient = stored.parts[0]!.ingredients[0]!;

  test("renders the editor's own ingredient fields, with Save and Cancel", () => {
    const html = renderToString(<QuickEditIngredientBody ingredient={row} units={[gram]} onSave={() => {}} onCancel={() => {}} />);

    expect(html).toContain("Edit ingredient");
    expect(html).toContain('aria-label="Ingredient quantity"');
    expect(html).toContain('aria-label="Ingredient unit"');
    expect(html).toContain('aria-label="Ingredient food"');
    expect(html).toContain('aria-label="Ingredient note"');
    expect(html).toContain('aria-label="Ingredient fixed"');
    expect(html).toContain("Original text");
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("starts on the stored row's own values", () => {
    const html = renderToString(<QuickEditIngredientBody ingredient={row} units={[gram]} onSave={() => {}} onCancel={() => {}} />);
    expect(html).toContain('value="200"');
    expect(html).toContain('value="gram"');
    expect(html).toContain('value="flour"');
  });

  test("while saving the buttons are disabled, and a failure shows", () => {
    const html = renderToString(<QuickEditIngredientBody ingredient={row} units={[gram]} busy error="Nope" onSave={() => {}} onCancel={() => {}} />);
    expect(html).toContain("Saving…");
    expect(html).toContain("disabled");
    expect(html).toContain("Nope");
  });
});

describe("QuickEditStepBody", () => {
  test("renders the step's text in a textarea, with the preview toggle", () => {
    const html = renderToString(<QuickEditStepBody text="Whisk **well**" onSave={() => {}} onCancel={() => {}} />);

    expect(html).toContain("Edit step");
    expect(html).toContain("<textarea");
    expect(html).toContain("Whisk **well**");
    expect(html).toContain('aria-label="Preview step"');
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("previewing swaps the textarea for the rendered markdown", () => {
    const html = renderToString(<QuickEditStepBody text="Whisk **well**" preview onSave={() => {}} onCancel={() => {}} />);

    expect(html).not.toContain("<textarea");
    expect(html).toMatch(/<strong[^>]*>well<\/strong>/);
  });

  test("while saving the buttons are disabled, and a failure shows", () => {
    const html = renderToString(<QuickEditStepBody text="Whisk" busy error="Nope" onSave={() => {}} onCancel={() => {}} />);
    expect(html).toContain("Saving…");
    expect(html).toContain("disabled");
    expect(html).toContain("Nope");
  });
});
