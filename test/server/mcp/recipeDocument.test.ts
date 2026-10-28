// Claude's recipe shape to garnish's document and back: lines parsed against the household's vocabulary.
import { expect, test } from "vitest";
import { recipeSchema } from "../../../src/domain/recipe";
import type { FoodRow, Unit } from "../../../src/domain/reference";
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

test("kind is read, set, cleared, and kept by an update that does not send it", () => {
  const created = parseDocument(documentFromMcp(createRecipeSchema.parse({ name: "Laksa", kind: "rotation", parts: [{}] }), vocabulary, null).doc);
  expect(created.kind).toBe("rotation");
  const stored = recipeSchema.parse({
    ...created,
    id: "00000000-0000-4000-8000-0000000000d2",
    slug: "laksa",
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
    parts: created.parts.map((part) => ({ ...part, id: crypto.randomUUID() })),
  });
  expect(recipeForMcp(stored).kind).toBe("rotation");
  expect(documentFromMcp(updateRecipeSchema.parse({ name: "Chicken laksa" }), vocabulary, stored).doc.kind).toBe("rotation");
  expect(documentFromMcp(updateRecipeSchema.parse({ kind: "weekend" }), vocabulary, stored).doc.kind).toBe("weekend");
  expect(documentFromMcp(updateRecipeSchema.parse({ kind: null }), vocabulary, stored).doc.kind).toBeNull();
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
