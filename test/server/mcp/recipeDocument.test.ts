// Claude's recipe shape to garnish's document and back: lines parsed against the household's vocabulary.
import { expect, test } from "vitest";
import { recipeSchema } from "../../../src/domain/recipes/recipe";
import type { FoodRow, Unit } from "../../../src/domain/recipes/reference";
import { createRecipeSchema, documentFromMcp, parseDocument, recipeForMcp, updateRecipeSchema } from "../../../src/server/mcp/recipeDocument";

const unit = (id: string, name: string, abbreviation: string): Unit => ({
  id,
  name,
  pluralName: null,
  abbreviation,
  useAbbreviation: true,
  fraction: false,
  portion: false,
  standardQuantity: null,
  standardUnitId: null,
});
const food = (id: string, name: string, pluralName: string | null = null, aliases: string[] = []): FoodRow => ({
  id,
  name,
  pluralName,
  aliases,
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
});

const GRAM = unit("00000000-0000-4000-8000-0000000000a1", "gram", "g");
const ONION = food("00000000-0000-4000-8000-0000000000b1", "spring onion", "spring onions", ["scallion"]);
const TBSP = unit("00000000-0000-4000-8000-0000000000a2", "tablespoon", "tbsp");
const TSP = unit("00000000-0000-4000-8000-0000000000a3", "teaspoon", "tsp");
const vocabulary = { units: [GRAM, TBSP, TSP], foods: [ONION], tags: [{ id: "00000000-0000-4000-8000-0000000000c1", name: "Weeknight", slug: "weeknight" }] };

test("a line is parsed against the household's foods, by plural or other name too", () => {
  const input = createRecipeSchema.parse({
    name: "Noodles",
    parts: [{ ingredients: ["200 g spring onions, thinly sliced", "1 scallion"] }],
    tags: ["weeknight"],
  });
  const { doc, report } = documentFromMcp(input, vocabulary, null);
  const [first, second] = doc.parts[0]!.ingredients!;
  expect(first).toMatchObject({ quantity: 200, unit: { id: GRAM.id }, food: { id: ONION.id }, note: "thinly sliced" });
  expect(second).toMatchObject({ quantity: 1, food: { id: ONION.id } });
  expect(doc.tags).toEqual([vocabulary.tags[0]]);
  expect(report).toEqual({ createdFoods: [], textOnly: [] });
});

test("no word of a line is lost: a size the household has no unit for and the words after the food stay in the note (row 221)", () => {
  const input = createRecipeSchema.parse({ name: "Onions", parts: [{ ingredients: ["2 large spring onions, sliced", "1 tbsp spring onion paste"] }] });
  const [first, second] = documentFromMcp(input, vocabulary, null).doc.parts[0]!.ingredients!;
  expect(first).toMatchObject({ quantity: 2, unit: null, food: { id: ONION.id }, note: "large, sliced" });
  expect(second).toMatchObject({ quantity: 1, unit: { id: TBSP.id }, food: { id: ONION.id }, note: "paste" });
});

test("a line can name its food outright; a name the household doesn't have is refused (row 222)", () => {
  const BLACK = food("00000000-0000-4000-8000-0000000000b2", "black peppercorns", null, ["white peppercorns"]);
  const WHITE = food("00000000-0000-4000-8000-0000000000b3", "white peppercorns", null);
  const peppers = { ...vocabulary, foods: [BLACK, WHITE] };
  const read = (ingredients: unknown[]) =>
    documentFromMcp(createRecipeSchema.parse({ name: "Stock", parts: [{ ingredients }] }), peppers, null).doc.parts[0]!.ingredients!;

  expect(read(["½ tbsp white peppercorns"])[0]).toMatchObject({ food: { id: BLACK.id } });
  expect(read([{ text: "½ tbsp white peppercorns", food: "white peppercorns" }])[0]).toMatchObject({
    quantity: 0.5,
    unit: { id: TBSP.id },
    food: { id: WHITE.id },
    note: "",
  });
  expect(read([{ text: "1 tsp whole pepper, cracked", food: "White Peppercorns" }])[0]).toMatchObject({
    food: { id: WHITE.id },
    note: "whole pepper, cracked",
  });
  expect(() => read([{ text: "1 tsp pink peppercorns", food: "pink peppercorns" }])).toThrow(/not one of the household's foods/);
});

test("an unknown short food is created once however many lines name it; a long one stays text", () => {
  const input = createRecipeSchema.parse({
    name: "Kimchi",
    parts: [{ ingredients: ["2 tbsp gochugaru", "1 tsp gochugaru", "1 handful of whatever greens are left in the fridge"] }],
  });
  const { doc, report } = documentFromMcp(input, vocabulary, null);
  const rows = doc.parts[0]!.ingredients!;
  expect(rows[0]!.food).toBe(rows[1]!.food);
  expect(rows[0]).toMatchObject({ quantity: 2, unit: { id: TBSP.id }, food: { name: "gochugaru" } });
  expect(report.createdFoods).toEqual(["gochugaru"]);
  expect(rows[2]).toMatchObject({ food: null, quantity: null, originalText: "1 handful of whatever greens are left in the fridge" });
  expect(report.textOnly).toEqual(["1 handful of whatever greens are left in the fridge"]);
});

test("steps get links to the ingredients they mention", () => {
  const input = createRecipeSchema.parse({ name: "Onions", parts: [{ ingredients: ["2 spring onions"], steps: ["Slice the spring onions.", "Serve."] }] });
  const { doc } = documentFromMcp(input, vocabulary, null);
  const part = doc.parts[0]!;
  expect(part.steps![0]!.ingredientIds).toEqual([part.ingredients![0]!.id]);
  expect(part.steps![1]!.ingredientIds).toEqual([]);
});

test("the week is read, set, and kept by an update that does not send it (row 219)", () => {
  const created = parseDocument(
    documentFromMcp(createRecipeSchema.parse({ name: "Laksa", facets: { week: ["weeknight"] }, parts: [{}] }), vocabulary, null).doc
  );
  expect(created.facets.week).toEqual(["weeknight"]);
  const stored = recipeSchema.parse({
    ...created,
    id: "00000000-0000-4000-8000-0000000000d2",
    slug: "laksa",
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
    parts: created.parts.map((part) => ({ ...part, id: crypto.randomUUID() })),
  });
  expect(recipeForMcp(stored).facets.week).toEqual(["weeknight"]);
  expect(documentFromMcp(updateRecipeSchema.parse({ name: "Chicken laksa" }), vocabulary, stored).doc.facets?.week).toEqual(["weeknight"]);
  expect(parseDocument(documentFromMcp(updateRecipeSchema.parse({ facets: { week: ["weekend", "weeknight"] } }), vocabulary, stored).doc).facets.week).toEqual([
    "weeknight",
    "weekend",
  ]);
  expect(documentFromMcp(updateRecipeSchema.parse({ facets: { week: [] } }), vocabulary, stored).doc.facets?.week).toEqual([]);
});

test("facets are read, set on a create, and merged by layer on an update: a layer sent replaces, [] clears, one left out stays", () => {
  const created = parseDocument(
    documentFromMcp(createRecipeSchema.parse({ name: "Salsa verde", facets: { course: ["sauce"], cuisine: ["italian"] }, parts: [{}] }), vocabulary, null).doc
  );
  expect(created.facets).toEqual({ course: ["sauce"], meal: [], week: [], cuisine: ["italian"], diet: [], mainIngredient: [], method: [], season: [] });
  const stored = recipeSchema.parse({
    ...created,
    id: "00000000-0000-4000-8000-0000000000d3",
    slug: "salsa-verde",
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
    parts: created.parts.map((part) => ({ ...part, id: crypto.randomUUID() })),
  });
  expect(recipeForMcp(stored).facets).toEqual(created.facets);
  expect(documentFromMcp(updateRecipeSchema.parse({ name: "Green sauce" }), vocabulary, stored).doc.facets).toEqual(created.facets);
  const changed = documentFromMcp(updateRecipeSchema.parse({ facets: { diet: ["vegan", "vegetarian"], cuisine: [] } }), vocabulary, stored).doc;
  expect(parseDocument(changed).facets).toEqual({
    course: ["sauce"],
    meal: [],
    week: [],
    cuisine: [],
    diet: ["vegetarian", "vegan"],
    mainIngredient: [],
    method: [],
    season: [],
  });
  expect(() => updateRecipeSchema.parse({ facets: { course: ["chutney"] } })).toThrow();
});

test("an update keeps what it does not send, and keeps unchanged rows whole", () => {
  const created = parseDocument(
    documentFromMcp(
      createRecipeSchema.parse({ name: "Onions", servings: 4, parts: [{ ingredients: ["2 spring onions"], steps: ["Slice the spring onions."] }] }),
      vocabulary,
      null
    ).doc
  );
  const stored = recipeSchema.parse({
    ...created,
    id: "00000000-0000-4000-8000-0000000000d1",
    slug: "onions",
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
    parts: created.parts.map((part) => ({ ...part, id: crypto.randomUUID(), steps: part.steps.map((step) => ({ ...step, image: "photo.jpg" })) })),
  });
  const read = recipeForMcp(stored);
  expect(read.parts[0]!.ingredients[0]).toMatchObject({ text: "2 spring onions", food: "spring onion" });

  // Just the name: everything else stays.
  const renamed = documentFromMcp(updateRecipeSchema.parse({ name: "Charred onions" }), vocabulary, stored).doc;
  expect(renamed).toMatchObject({ name: "Charred onions", recipeServings: 4 });
  expect(renamed.parts).toBe(stored.parts);

  // Parts sent back with ids: an unchanged step keeps its photo and links; a new line is parsed.
  const [part] = read.parts;
  const edited = documentFromMcp(
    updateRecipeSchema.parse({
      parts: [
        {
          id: part!.id,
          name: "",
          ingredients: [{ id: part!.ingredients[0]!.id, text: "2 spring onions" }, "50 g butter"],
          steps: [{ id: part!.steps[0]!.id, text: "Slice the spring onions." }],
        },
      ],
    }),
    vocabulary,
    stored
  ).doc;
  const editedPart = edited.parts[0]!;
  expect(editedPart.id).toBe(part!.id);
  expect(editedPart.ingredients![0]).toBe(stored.parts[0]!.ingredients[0]);
  expect(editedPart.steps![0]).toMatchObject({ id: part!.steps[0]!.id, image: "photo.jpg", ingredientIds: [part!.ingredients[0]!.id] });
  expect(editedPart.ingredients![1]).toMatchObject({ quantity: 50, unit: { id: GRAM.id }, food: { name: "butter" } });
});

test("parseDocument says what is wrong", () => {
  expect(() => parseDocument({ name: "", parts: [] })).toThrow(/parts/);
});
