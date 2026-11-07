// The read as the draft Check opens on (decisions.md row 203): linked where the
// library knows a line, a placeholder the save creates where an export names
// what it lacks, and the raw line, asked about, where the parse could not settle.
import { describe, expect, test } from "vitest";
import {
  addedAsNew,
  checkStatus,
  importDraft,
  lineRead,
  linesToCheck,
  livePending,
  pendingLabel,
  placeholders,
  removeIngredient,
  reviewRead,
  rowRead,
  textLines,
  withIngredientPatched,
} from "../../../../src/domain/recipes/draft";
import type { ScrapedRecipe } from "../../../../src/domain/recipes/import";
import { reviewRows } from "../../../../src/domain/recipes/ingredient";
import { noFacets } from "../../../../src/domain/recipes/recipe";
import type { FoodRow, Unit } from "../../../../src/domain/recipes/reference";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
};
const flour: FoodRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const vocabulary = { units: [gram], foods: [flour] };

const scraped: ScrapedRecipe = {
  name: "Lemon tart",
  description: "",
  image: null,
  servings: 8,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  facets: noFacets(),
  parts: [
    { name: "Pastry", ingredients: ["200 g flour", "100 g quince paste"], steps: ["Rub in."] },
    { name: "Filling", ingredients: ["(see notes)"], steps: ["Bake."] },
  ],
};
const lines = scraped.parts.flatMap((part) => part.ingredients);

describe("importDraft", () => {
  const rows = reviewRows(lines, vocabulary);
  const { draft, pending } = importDraft({ scraped, sourceUrl: "https://example.test/tart", rows });
  const [pastry, filling] = draft.parts;

  test("a known line comes in linked, on the part it was read from", () => {
    expect(pastry!.name).toBe("Pastry");
    expect(pastry!.ingredients[0]!.food?.id).toBe(flour.id);
    expect(pastry!.ingredients[0]!.unit?.id).toBe(gram.id);
    expect(pastry!.ingredients[0]!.quantity).toBe(200);
  });

  test("a line naming a food the library lacks comes in as its words, and is asked about", () => {
    const quince = pastry!.ingredients[1]!;
    expect(quince.food).toBeNull();
    expect(quince.originalText).toBe("100 g quince paste");
    expect(Object.keys(pending)).toEqual([quince.id]);
    expect(pendingLabel(pending[quince.id!]!)).toBe("New food: quince paste");
  });

  test("a line the parse found nothing in is plain text and asks nothing", () => {
    expect(filling!.ingredients[0]!.originalText).toBe("(see notes)");
    expect(Object.keys(pending)).not.toContain(filling!.ingredients[0]!.id);
  });

  test("the status counts what is linked and what is still asked about", () => {
    expect(checkStatus(draft, pending)).toBe("1 linked · 1 needs a food");
  });

  test("Add takes the parse with the new food as a placeholder, which no row of the library has", () => {
    const quince = pastry!.ingredients[1]!;
    const patch = addedAsNew(pending[quince.id!]!);
    expect(patch?.quantity).toBe(100);
    expect(patch?.unit?.id).toBe(gram.id);
    expect(patch?.food?.name).toBe("quince paste");
    expect(patch?.food?.id).not.toBe(flour.id);
    const added = withIngredientPatched(draft, quince.id!, patch!);
    expect(added.parts[0]!.ingredients[1]!.food?.name).toBe("quince paste");
    expect(added.parts[0]!.ingredients[1]!.originalText).toBe("100 g quince paste");
    expect(checkStatus(added, {})).toBe("2 linked");
  });

  test("a line removed on Check is no longer asked about", () => {
    const without = removeIngredient(draft, 0, 1);
    expect(livePending(without, pending)).toEqual({});
  });
});

describe("placeholders", () => {
  test("an export's unknown food and unit are placeholders by name, not created rows", () => {
    const rows = reviewRows(["2 knobs butter"], vocabulary).map((row) => ({
      ...row,
      food: { kind: "create" as const, name: "butter" },
      unit: { kind: "create" as const, name: "knob" },
    }));
    const made = placeholders(rows);
    expect(made.foods.get("butter")?.name).toBe("butter");
    expect(made.units.get("knob")?.name).toBe("knob");
  });

  test("a food standing for a recipe already here is used instead of a placeholder", () => {
    const rows = reviewRows(["1 cup pastry"], vocabulary).map((row) => ({ ...row, food: { kind: "create" as const, name: "Pastry" } }));
    const linked = new Map([["pastry", { ...flour, id: "22222222-2222-4222-8222-222222222222", name: "Pastry" }]]);
    expect(placeholders(rows, linked).foods.get("pastry")?.id).toBe("22222222-2222-4222-8222-222222222222");
  });

  test("an export's rows come in linked through their placeholders, nothing asked", () => {
    const rows = reviewRows(["2 knobs butter"], vocabulary).map((row) => ({
      ...row,
      food: { kind: "create" as const, name: "butter" },
      unit: { kind: "create" as const, name: "knob" },
    }));
    const { draft, pending } = importDraft({
      scraped: { ...scraped, parts: [{ name: "", ingredients: ["2 knobs butter"], steps: [] }] },
      sourceUrl: "",
      rows,
    });
    const row = draft.parts[0]!.ingredients[0]!;
    expect(row.food?.name).toBe("butter");
    expect(row.unit?.name).toBe("knob");
    expect(pending).toEqual({});
  });
});

describe("linesToCheck, what a phone's Check puts first (decisions.md row 208)", () => {
  const rows = reviewRows(lines, vocabulary);
  const { draft, pending } = importDraft({ scraped, sourceUrl: "https://example.test/tart", rows });
  const quince = draft.parts[0]!.ingredients[1]!.id!;
  const notes = draft.parts[1]!.ingredients[0]!.id!;
  const text = textLines(draft, pending);

  test("a food the library lacks, and a line no food was read from; never a matched line", () => {
    expect(text).toEqual([notes]);
    expect(linesToCheck(draft, pending, text, new Set())).toEqual([
      { id: quince, kind: "food", reason: "“quince paste” isn't one of your foods yet" },
      { id: notes, kind: "text", reason: "No food was read from this line, so it is kept as written" },
    ]);
  });

  test("a line passed as right, given a food or removed is not asked about again", () => {
    expect(linesToCheck(draft, pending, text, new Set([notes])).map((flag) => flag.id)).toEqual([quince]);
    const given = withIngredientPatched(draft, notes, { food: { id: flour.id, name: "flour" } as never });
    expect(linesToCheck(given, pending, text, new Set()).map((flag) => flag.id)).toEqual([quince]);
    expect(linesToCheck(removeIngredient(draft, 0, 1), pending, text, new Set()).map((flag) => flag.id)).toEqual([notes]);
  });
});

describe("how a line reads on a phone", () => {
  test("a typed line by the parser: the amount and unit, the food, the note, and whether the food is known", () => {
    expect(lineRead("200 g flour, sifted", vocabulary)).toEqual({ kind: "read", amount: "200 g", food: "flour", note: "sifted", fixed: false, known: true });
    expect(lineRead("salt", vocabulary)).toMatchObject({ amount: "", food: "salt", known: false });
    expect(lineRead("(see notes)", vocabulary)).toEqual({ kind: "text", text: "(see notes)" });
  });

  test("a draft row by its fields, and a line still asked about as the parse proposed it", () => {
    const rows = reviewRows(lines, vocabulary);
    const { draft, pending } = importDraft({ scraped, sourceUrl: "", rows });
    expect(rowRead(draft.parts[0]!.ingredients[0]!)).toMatchObject({ amount: "200 g", food: "flour", known: true });
    expect(rowRead(draft.parts[0]!.ingredients[1]!)).toEqual({ kind: "text", text: "100 g quince paste" });
    expect(reviewRead(pending[draft.parts[0]!.ingredients[1]!.id!]!)).toMatchObject({ amount: "100 g", food: "quince paste", known: false });
  });
});
