// Recipe repository against :memory: with the real migration: round-trip of a
// full document, update replacing children, delete cascading, list filters.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { openDatabase } from "../../src/db/connection/open";
import { migrate } from "../../src/db/migrations/migrate";
import { type RecipeRepository, recipeRepository } from "../../src/db/models/recipe/repo";
import { type RecipeInput, recipeInputSchema, recipeSchema, recipeSummarySchema } from "../../src/domain/recipe";

let db: Database;
let repo: RecipeRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  repo = recipeRepository(db);
});

function count(table: string): number {
  return db.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table}`).get()!.n;
}

const ids = {
  recipe: "11111111-1111-4111-8111-111111111111",
  pasta: "22222222-2222-4222-8222-222222222222",
  sauce: "33333333-3333-4333-8333-333333333333",
  finish: "34343434-3434-4343-8343-343434343434",
  g: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ml: "abababab-abab-4bab-8bab-abababababab",
  butter: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  spaghetti: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  weeknight: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  pasta_tag: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
  dairy: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  note: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
  ing1: "01010101-0101-4101-8101-010101010101",
  ing2: "02020202-0202-4202-8202-020202020202",
  ing3: "03030303-0303-4303-8303-030303030303",
  step1: "04040404-0404-4404-8404-040404040404",
  step2: "05050505-0505-4505-8505-050505050505",
  step3: "06060606-0606-4606-8606-060606060606",
};

const gram = {
  id: ids.g,
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};
const dairy = { id: ids.dairy, name: "Dairy", position: 0 };
const butter = {
  id: ids.butter,
  name: "butter",
  pluralName: null,
  aliases: ["unsalted butter"],
  aisle: dairy,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const spaghetti = {
  id: ids.spaghetti,
  name: "spaghetti",
  pluralName: "spaghetti",
  aliases: [],
  aisle: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const weeknight = { id: ids.weeknight, name: "Weeknight", slug: "weeknight" };
const pastaTag = { id: ids.pasta_tag, name: "Pasta", slug: "pasta" };

/** Every field set, every child carrying its own id, so the read must equal the write. */
const fullDoc: RecipeInput = {
  id: ids.recipe,
  name: "Butter Pasta",
  description: "Two components, one pan.",
  image: "butter-pasta.webp",
  rating: 4.5,
  lastMade: "2026-09-01T08:00:00.000Z",
  recipeServings: 2,
  recipeYieldQuantity: 600,
  yieldUnit: gram,
  recipeYield: "600 g",
  prepTime: 5,
  performTime: 15,
  sourceUrl: "https://example.com/butter-pasta",
  notes: [{ id: ids.note, title: "Tip", text: "Salt the water well." }],
  tags: [pastaTag, weeknight],
  parts: [
    {
      id: ids.pasta,
      name: "Pasta",
      ingredients: [
        { id: ids.ing1, quantity: 200, unit: gram, food: spaghetti, note: "", originalText: "200 g spaghetti", fixed: false },
        { id: ids.ing2, quantity: null, unit: null, food: null, note: "to taste", originalText: "salt, to taste", fixed: false },
      ],
      steps: [{ id: ids.step1, text: "Boil the pasta.", ingredientIds: [], image: null }],
    },
    {
      id: ids.sauce,
      name: "Sauce",
      ingredients: [{ id: ids.ing3, quantity: 50, unit: gram, food: butter, note: "cold", originalText: "50 g cold butter", fixed: true }],
      steps: [{ id: ids.step2, text: "Melt the butter.", ingredientIds: [], image: null }],
    },
    { id: ids.finish, name: "", ingredients: [], steps: [{ id: ids.step3, text: "Toss together and serve.", ingredientIds: [], image: null }] },
  ],
};

const minimal = (name: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  name,
  parts: [{ name: "", ingredients: [], steps: [] }],
  ...extra,
});

test("create round-trips a full document and creates its references", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));

  expect(recipeSchema.parse(created)).toEqual(created);
  expect(created.slug).toBe("butter-pasta");
  expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(created.updatedAt).toBe(created.createdAt);

  // New references were inserted from the document; their ids are the server's.
  expect(count("unit")).toBe(1);
  expect(count("food")).toBe(2);
  expect(count("aisle")).toBe(1);
  expect(count("tag")).toBe(2);
  const g = created.yieldUnit!;
  const foodByName = Object.fromEntries(
    created.parts
      .flatMap((c) => c.ingredients)
      .filter((i) => i.food)
      .map((i) => [i.food!.name, i.food!])
  );
  const tagByName = Object.fromEntries(created.tags.map((t) => [t.name, t]));
  expect(g).toEqual({ ...gram, id: g.id });
  expect(foodByName.butter).toEqual({ ...butter, id: foodByName.butter!.id, aisle: { ...dairy, id: foodByName.butter!.aisle!.id } });
  expect(foodByName.spaghetti).toEqual({ ...spaghetti, id: foodByName.spaghetti!.id });
  expect(tagByName.Weeknight).toEqual({ ...weeknight, id: tagByName.Weeknight!.id });
  expect(tagByName.Pasta).toEqual({ ...pastaTag, id: tagByName.Pasta!.id });

  // Everything else is exactly what was written, including child ids and order.
  const { createdAt, updatedAt, slug, ...rest } = created;
  const expected = recipeInputSchema.parse(fullDoc);
  const withServerIds = {
    ...expected,
    restyledAt: null, // read-only, and nothing has been restyled (M37.5)
    yieldUnit: g,
    tags: [tagByName.Pasta, tagByName.Weeknight],
    parts: expected.parts.map((c) => ({
      ...c,
      ingredients: c.ingredients.map((i) => ({ ...i, unit: i.unit ? g : null, food: i.food ? foodByName[i.food.name] : null })),
    })),
  };
  expect(rest).toEqual(withServerIds);

  // Read paths agree.
  expect(repo.get("butter-pasta")).toEqual(created);
  expect(repo.getById(ids.recipe)).toEqual(created);
  expect(repo.get("nope")).toBeNull();
  expect(repo.getById("nope")).toBeNull();

  // Writing the read document back is a no-op on content: the editor saves exactly what it loaded.
  const again = repo.ref(created.id).replace(recipeInputSchema.parse(created))!;
  expect({ ...again, updatedAt: created.updatedAt }).toEqual(created);
});

test("create resolves references by id, then by name case-insensitively, and never edits existing rows", () => {
  const first = repo.create(recipeInputSchema.parse(fullDoc));
  const g = first.yieldUnit!;

  const second = repo.create(
    recipeInputSchema.parse(
      minimal("Buttered Toast", {
        yieldUnit: { ...gram, id: g.id, abbreviation: "grams!" }, // by id; attributes ignored
        tags: [{ id: crypto.randomUUID(), name: "WEEKNIGHT", slug: "whatever" }], // by name
        parts: [
          {
            name: "",
            ingredients: [
              {
                quantity: 10,
                unit: { ...gram, id: crypto.randomUUID(), name: " Gram " },
                food: { ...butter, id: crypto.randomUUID(), name: "Butter" },
                note: "",
                originalText: "",
                fixed: false,
              },
            ],
            steps: [],
          },
        ],
      })
    )
  );

  expect(count("unit")).toBe(1);
  expect(count("food")).toBe(2);
  expect(count("tag")).toBe(2);
  expect(second.yieldUnit).toEqual(g);
  expect(second.parts[0]!.ingredients[0]!.unit).toEqual(g);
  expect(second.parts[0]!.ingredients[0]!.food!.name).toBe("butter");
  expect(second.tags.map((t) => t.name)).toEqual(["Weeknight"]);
});

test("slugs are lowercase ASCII, de-duplicated with -2, -3", () => {
  expect(repo.create(recipeInputSchema.parse(minimal("Crème Brûlée!"))).slug).toBe("creme-brulee");
  expect(repo.create(recipeInputSchema.parse(minimal("Creme brulee"))).slug).toBe("creme-brulee-2");
  expect(repo.create(recipeInputSchema.parse(minimal("CREME BRULEE"))).slug).toBe("creme-brulee-3");
  expect(repo.create(recipeInputSchema.parse(minimal("???"))).slug).toBe("untitled");
});

test("update replaces components, steps, notes and tags in place and keeps id and slug", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));

  const updated = repo.ref(created.id).replace(
    recipeInputSchema.parse({
      ...fullDoc,
      description: "Now flat.",
      rating: 5,
      tags: [weeknight],
      notes: [],
      parts: [
        {
          name: "",
          ingredients: [
            {
              quantity: 1,
              unit: null,
              food: { ...butter, id: crypto.randomUUID(), name: "Parmesan" },
              note: "",
              originalText: "a handful of parmesan",
              fixed: false,
            },
          ],
          steps: [{ id: ids.step1, text: "Grate.", ingredientIds: [], image: null }],
        },
        { name: "", ingredients: [], steps: [{ text: "Serve." }, { text: "Eat." }] },
      ],
    })
  )!;

  expect(updated.id).toBe(created.id);
  expect(updated.slug).toBe("butter-pasta");
  expect(updated.createdAt).toBe(created.createdAt);
  expect(updated.updatedAt >= created.updatedAt).toBe(true);
  expect(updated.description).toBe("Now flat.");
  expect(updated.rating).toBe(5);
  expect(updated.notes).toEqual([]);
  expect(updated.tags.map((t) => t.name)).toEqual(["Weeknight"]);
  expect(updated.parts).toHaveLength(2);
  expect(updated.parts[0]!.name).toBe("");
  expect(updated.parts[0]!.ingredients).toHaveLength(1);
  expect(updated.parts[0]!.ingredients[0]!.food!.name).toBe("Parmesan");
  expect(updated.parts[0]!.steps).toEqual([{ id: ids.step1, text: "Grate.", ingredientIds: [], image: null }]);
  expect(updated.parts[1]!.steps.map((s) => s.text)).toEqual(["Serve.", "Eat."]);

  // Old children are gone from the tables, not just from the document.
  expect(count("part")).toBe(2);
  expect(count("ingredient")).toBe(1);
  expect(count("step")).toBe(3);
  expect(count("recipe_note")).toBe(0);
  expect(count("recipe_tag")).toBe(1);
  // References survive an update that stops using them.
  expect(count("food")).toBe(3);
  expect(count("tag")).toBe(2);
  expect(count("unit")).toBe(1);

  expect(repo.get("butter-pasta")).toEqual(updated);
  expect(repo.ref("missing").replace(recipeInputSchema.parse(minimal("x")))).toBeNull();
});

test("update regenerates the slug only when the name changes", () => {
  repo.create(recipeInputSchema.parse(minimal("Toast-2")));
  const created = repo.create(recipeInputSchema.parse(minimal("Toast")));
  expect(created.slug).toBe("toast");

  expect(repo.ref(created.id).replace(recipeInputSchema.parse(minimal("Toast", { description: "same name" })))!.slug).toBe("toast");
  const renamed = repo.ref(created.id).replace(recipeInputSchema.parse(minimal("Toast 2")))!;
  expect(renamed.slug).toBe("toast-2-2"); // "toast-2" is taken by the other recipe
  expect(repo.get("toast")).toBeNull();
  expect(repo.get("toast-2-2")!.id).toBe(created.id);
  // Renaming back reclaims the free slug rather than suffixing against itself.
  expect(repo.ref(created.id).replace(recipeInputSchema.parse(minimal("Toast")))!.slug).toBe("toast");
});

test("a failing write leaves the previous recipe intact", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  const bad = recipeInputSchema.parse({ ...fullDoc, description: "broken" });
  // Duplicate child id inside one document violates the primary key mid-transaction.
  bad.parts[0]!.steps = [
    { id: ids.step1, text: "dup", ingredientIds: [], image: null },
    { id: ids.step1, text: "dup", ingredientIds: [], image: null },
  ];

  expect(() => repo.ref(created.id).replace(bad)).toThrow(/UNIQUE|PRIMARY/);
  expect(repo.get("butter-pasta")).toEqual(created);
  expect(count("recipe")).toBe(1);

  expect(() =>
    repo.create(
      recipeInputSchema.parse({
        ...minimal("Broken"),
        parts: [
          {
            name: "",
            ingredients: [],
            steps: [
              { id: ids.step1, text: "dup", ingredientIds: [], image: null },
              { id: ids.step1, text: "dup", ingredientIds: [], image: null },
            ],
          },
        ],
      })
    )
  ).toThrow(/UNIQUE|PRIMARY/);
  expect(count("recipe")).toBe(1);
  expect(count("part")).toBe(3);
});

test("remove cascades to every child and leaves references", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  repo.create(recipeInputSchema.parse(minimal("Other", { tags: [weeknight] })));

  expect(repo.remove(created.id)).toBe(true);
  expect(repo.remove(created.id)).toBe(false);

  expect(repo.get("butter-pasta")).toBeNull();
  expect(count("recipe")).toBe(1);
  expect(count("part")).toBe(1);
  expect(count("ingredient")).toBe(0);
  expect(count("step")).toBe(0);
  expect(count("recipe_note")).toBe(0);
  expect(count("recipe_tag")).toBe(1);
  expect(count("unit")).toBe(1);
  expect(count("food")).toBe(2);
  expect(count("aisle")).toBe(1);
  expect(count("tag")).toBe(2);
});

test("list returns summaries filtered by name substring and by tag slug", () => {
  const full = repo.create(recipeInputSchema.parse(fullDoc));
  const toast = repo.create(recipeInputSchema.parse(minimal("Cheese Toast", { tags: [weeknight], prepTime: 2 })));
  const soup = repo.create(recipeInputSchema.parse(minimal("Pumpkin soup", { rating: 3 })));

  const all = repo.query();
  expect(all.map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast", "pumpkin-soup"]);
  for (const s of all) expect(recipeSummarySchema.parse(s)).toEqual(s);
  const bySlug = Object.fromEntries(all.map((r) => [r.slug, r]));
  expect(bySlug["butter-pasta"]).toEqual({
    id: full.id,
    slug: "butter-pasta",
    name: "Butter Pasta",
    image: "butter-pasta.webp",
    rating: 4.5,
    prepTime: 5,
    performTime: 15,
    totalTime: 20,
    lastMade: "2026-09-01T08:00:00.000Z",
    favourite: false,
    tags: full.tags,
    ingredientPreview: ["200 g spaghetti", "salt, to taste", "50 g butter, cold"],
  });
  expect(bySlug["cheese-toast"]).toEqual({
    id: toast.id,
    slug: "cheese-toast",
    name: "Cheese Toast",
    image: null,
    rating: null,
    prepTime: 2,
    performTime: null,
    totalTime: 2,
    lastMade: null,
    favourite: false,
    tags: toast.tags,
    ingredientPreview: [],
  });
  expect(bySlug["pumpkin-soup"]!.rating).toBe(3);
  expect(bySlug["pumpkin-soup"]!.tags).toEqual([]);

  expect(repo.query({ by: "filter", q: "PAST" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(
    repo
      .query({ by: "filter", q: "s" })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["butter-pasta", "cheese-toast", "pumpkin-soup"]);
  expect(repo.query({ by: "filter", q: "" }).length).toBe(3);
  expect(repo.query({ by: "filter", q: "nothing" })).toEqual([]);

  expect(
    repo
      .query({ by: "filter", tags: ["weeknight"] })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["butter-pasta", "cheese-toast"]);
  expect(repo.query({ by: "filter", tags: ["pasta"] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.query({ by: "filter", tags: ["weeknight"], q: "toast" }).map((r) => r.slug)).toEqual(["cheese-toast"]);
  expect(repo.query({ by: "filter", tags: ["missing"] })).toEqual([]);
  expect(soup.tags).toEqual([]);
});

test("a summary's ingredientPreview is the first six lines, part order then row order, capped at six (M35.3)", () => {
  const doc: RecipeInput = {
    name: "Many Lines",
    parts: [
      {
        name: "A",
        ingredients: [1, 2, 3, 4].map((n) => ({
          quantity: n,
          unit: gram,
          food: { id: crypto.randomUUID(), name: `food ${n}` },
        })),
        steps: [],
      },
      {
        name: "B",
        ingredients: [5, 6, 7].map((n) => ({
          quantity: n,
          unit: gram,
          food: { id: crypto.randomUUID(), name: `food ${n}` },
        })),
        steps: [],
      },
    ],
  };
  const created = repo.create(recipeInputSchema.parse(doc));
  const summary = repo.query().find((r) => r.id === created.id)!;
  // Seven lines across two parts; the seventh (part B's third row) is dropped.
  expect(summary.ingredientPreview).toEqual(["1 g food 1", "2 g food 2", "3 g food 3", "4 g food 4", "5 g food 5", "6 g food 6"]);
});

test("list filters by tags[] with any (default) and all match", () => {
  repo.create(recipeInputSchema.parse(fullDoc)); // tags: Pasta, Weeknight
  repo.create(recipeInputSchema.parse(minimal("Cheese Toast", { tags: [weeknight] })));
  repo.create(recipeInputSchema.parse(minimal("Pumpkin soup")));

  // any: either tag.
  expect(
    repo
      .query({ by: "filter", tags: ["pasta", "weeknight"] })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["butter-pasta", "cheese-toast"]);
  expect(
    repo
      .query({ by: "filter", tags: ["pasta", "weeknight"], match: "any" })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["butter-pasta", "cheese-toast"]);
  // all: only the recipe carrying every tag.
  expect(repo.query({ by: "filter", tags: ["pasta", "weeknight"], match: "all" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.query({ by: "filter", tags: ["missing"] })).toEqual([]);
  // A slug given twice is one constraint, not two.
  expect(repo.query({ by: "filter", tags: ["weeknight", "pasta", "weeknight"], match: "all" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(
    repo
      .query({ by: "filter", tags: ["weeknight", "weeknight"] })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["butter-pasta", "cheese-toast"]); // each once, not doubled
});

test("list filters by foods[]", () => {
  const full = repo.create(recipeInputSchema.parse(fullDoc)); // Pasta: spaghetti, salt; Sauce: butter
  repo.create(recipeInputSchema.parse(minimal("Cheese Toast")));
  const spaghettiId = full.parts[0]!.ingredients[0]!.food!.id;
  const butterId = full.parts[1]!.ingredients[0]!.food!.id;

  expect(repo.query({ by: "filter", foods: [spaghettiId] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.query({ by: "filter", foods: [butterId] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.query({ by: "filter", foods: [spaghettiId, crypto.randomUUID()] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.query({ by: "filter", foods: [crypto.randomUUID()] })).toEqual([]);
});

test("list filters by favourite", () => {
  repo.create(recipeInputSchema.parse(minimal("Fav", { favourite: true })));
  repo.create(recipeInputSchema.parse(minimal("Not fav")));

  expect(repo.query({ by: "filter", favourite: true }).map((r) => r.slug)).toEqual(["fav"]);
  expect(
    repo
      .query({ by: "filter", favourite: false })
      .map((r) => r.slug)
      .sort()
  ).toEqual(["fav", "not-fav"]);
  expect(
    repo
      .query()
      .map((r) => r.slug)
      .sort()
  ).toEqual(["fav", "not-fav"]);
});

test("list orders newest first", () => {
  const a = repo.create(recipeInputSchema.parse(minimal("A")));
  db.run("UPDATE recipe SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  const b = repo.create(recipeInputSchema.parse(minimal("B")));
  expect(repo.query().map((r) => r.id)).toEqual([b.id, a.id]);
});

test("list sorts by name, created and updated in both directions (M12.4)", () => {
  const b = repo.create(recipeInputSchema.parse(minimal("Banana cake")));
  const a = repo.create(recipeInputSchema.parse(minimal("Apple pie")));
  const c = repo.create(recipeInputSchema.parse(minimal("Carrot soup")));

  expect(repo.query({ by: "filter", sort: "name", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "banana-cake", "carrot-soup"]);
  expect(repo.query({ by: "filter", sort: "name", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "banana-cake", "apple-pie"]);
  // Omitted dir defaults per key: name reads ascending.
  expect(repo.query({ by: "filter", sort: "name" }).map((r) => r.slug)).toEqual(["apple-pie", "banana-cake", "carrot-soup"]);

  db.run("UPDATE recipe SET created_at = '2020-06-01T00:00:00.000Z' WHERE id = ?", [b.id]);
  db.run("UPDATE recipe SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  db.run("UPDATE recipe SET created_at = '2020-03-01T00:00:00.000Z' WHERE id = ?", [c.id]);
  expect(repo.query({ by: "filter", sort: "created", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.query({ by: "filter", sort: "created", dir: "desc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  // Omitted sort/dir keeps the original newest-created-first order.
  expect(repo.query().map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  // Omitted dir defaults per key: created reads newest first.
  expect(repo.query({ by: "filter", sort: "created" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);

  db.run("UPDATE recipe SET updated_at = '2021-06-01T00:00:00.000Z' WHERE id = ?", [b.id]);
  db.run("UPDATE recipe SET updated_at = '2021-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  db.run("UPDATE recipe SET updated_at = '2021-03-01T00:00:00.000Z' WHERE id = ?", [c.id]);
  expect(repo.query({ by: "filter", sort: "updated", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.query({ by: "filter", sort: "updated", dir: "desc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
});

test("list sorts by lastMade and rating, nulls last regardless of direction (M12.4)", () => {
  repo.create(recipeInputSchema.parse(minimal("Banana cake", { rating: 3 }))); // no lastMade
  repo.create(recipeInputSchema.parse(minimal("Apple pie", { lastMade: "2026-01-01T00:00:00.000Z" }))); // no rating
  repo.create(recipeInputSchema.parse(minimal("Carrot soup", { rating: 5, lastMade: "2026-06-01T00:00:00.000Z" })));

  expect(repo.query({ by: "filter", sort: "lastMade", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.query({ by: "filter", sort: "lastMade", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "apple-pie", "banana-cake"]);

  expect(repo.query({ by: "filter", sort: "rating", dir: "asc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  expect(repo.query({ by: "filter", sort: "rating", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "banana-cake", "apple-pie"]);
});

test("list sort random is stable for a given seed, reshuffles for a different one, and keeps the same rows (M12.4)", () => {
  const created = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name) => repo.create(recipeInputSchema.parse(minimal(name))));

  const first = repo.query({ by: "filter", sort: "random", seed: "seed-a" }).map((r) => r.id);
  const again = repo.query({ by: "filter", sort: "random", seed: "seed-a" }).map((r) => r.id);
  expect(again).toEqual(first);
  expect(first.slice().sort()).toEqual(created.map((r) => r.id).sort());

  const other = repo.query({ by: "filter", sort: "random", seed: "seed-b" }).map((r) => r.id);
  expect(other).not.toEqual(first);

  // A filter still applies before the shuffle.
  expect(repo.query({ by: "filter", sort: "random", seed: "seed-a", q: "alp" }).map((r) => r.slug)).toEqual(["alpha"]);
});

test("ref(id).setImage changes only the image column and reports whether the id exists", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { description: "Bread, heated." })));
  expect(created.image).toBeNull();

  expect(repo.ref(created.id).setImage(`${created.id}.png`)).toBe(true);
  const after = repo.getById(created.id)!;
  expect(after.image).toBe(`${created.id}.png`);
  expect({ ...after, image: null, updatedAt: created.updatedAt }).toEqual(created);

  expect(repo.ref(created.id).setImage(null)).toBe(true);
  expect(repo.getById(created.id)!.image).toBeNull();
  expect(repo.ref(ids.recipe).setImage("x.png")).toBe(false);
});

test("favourite round-trips through create, update and the list summary", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { favourite: true })));
  expect(created.favourite).toBe(true);
  expect(repo.query().find((r) => r.id === created.id)!.favourite).toBe(true);

  const updated = repo.ref(created.id).replace(recipeInputSchema.parse(minimal("Toast", { favourite: false })))!;
  expect(updated.favourite).toBe(false);
});

test("ref(id).rate writes the rating, clears it with null, and reports whether the id exists", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { description: "Bread, heated." })));
  expect(created.rating).toBeNull();

  expect(repo.ref(created.id).rate(4)).toBe(true);
  const after = repo.getById(created.id)!;
  expect(after.rating).toBe(4);
  expect({ ...after, rating: null, updatedAt: created.updatedAt }).toEqual(created);
  expect(repo.query().find((r) => r.id === created.id)!.rating).toBe(4);

  expect(repo.ref(created.id).rate(null)).toBe(true);
  expect(repo.getById(created.id)!.rating).toBeNull();
  expect(repo.ref(ids.recipe).rate(3)).toBe(false);
});

test("ref(id).favourite changes only the favourite column and reports whether the id exists", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { description: "Bread, heated." })));
  expect(created.favourite).toBe(false);

  expect(repo.ref(created.id).favourite(true)).toBe(true);
  const after = repo.getById(created.id)!;
  expect(after.favourite).toBe(true);
  expect({ ...after, favourite: false }).toEqual(created);
  expect(repo.query().find((r) => r.id === created.id)!.favourite).toBe(true);

  expect(repo.ref(created.id).favourite(false)).toBe(true);
  expect(repo.getById(created.id)!.favourite).toBe(false);
  expect(repo.ref(ids.recipe).favourite(true)).toBe(false);
});

// --- Step links (M28.1) ------------------------------------------------------
// A step names the ingredients of its own part, in the order the document
// listed them. Many to many: two rows on one step, one row on two steps.

/** Butter Pasta with a second pasta step, so the pasta part has two steps to link from. */
const linkedDoc = (): RecipeInput => ({
  ...fullDoc,
  parts: [
    {
      ...fullDoc.parts[0]!,
      steps: [
        { id: ids.step1, text: "Boil the pasta.", ingredientIds: [ids.ing2, ids.ing1] },
        { id: ids.step3, text: "Drain.", ingredientIds: [ids.ing1] },
      ],
    },
    { ...fullDoc.parts[1]!, steps: [{ id: ids.step2, text: "Melt the butter.", ingredientIds: [ids.ing3] }] },
    { id: ids.finish, name: "", ingredients: [], steps: [] },
  ],
});

test("a step reads back with the ingredients it links, in link order, and a row links from two steps", () => {
  const created = repo.create(recipeInputSchema.parse(linkedDoc()));

  const [pasta, sauce, finish] = created.parts;
  expect(pasta!.steps.map((s) => s.ingredientIds)).toEqual([[ids.ing2, ids.ing1], [ids.ing1]]);
  expect(sauce!.steps[0]!.ingredientIds).toEqual([ids.ing3]);
  expect(finish!.steps).toEqual([]);
  expect(count("step_ingredient")).toBe(4);

  // Round-trip: saving what was read changes nothing.
  const again = repo.ref(created.id).replace(recipeInputSchema.parse(created))!;
  expect({ ...again, updatedAt: created.updatedAt }).toEqual(created);
});

test("a link naming an ingredient outside the step's part is dropped, and so is a repeat", () => {
  const doc = linkedDoc();
  // ing3 lives in Sauce; ing1 lives in Pasta. Each step reaches into the other part.
  doc.parts[0]!.steps = [{ id: ids.step1, text: "Boil the pasta.", ingredientIds: [ids.ing3, ids.ing1, ids.ing1] }];
  doc.parts[1]!.steps = [{ id: ids.step2, text: "Melt the butter.", ingredientIds: [ids.ing1] }];

  const created = repo.create(recipeInputSchema.parse(doc));
  expect(created.parts[0]!.steps[0]!.ingredientIds).toEqual([ids.ing1]);
  expect(created.parts[1]!.steps[0]!.ingredientIds).toEqual([]);
  expect(count("step_ingredient")).toBe(1);
});

test("a step link goes with either side: deleting the recipe clears the table, and so does dropping a row", () => {
  const created = repo.create(recipeInputSchema.parse(linkedDoc()));
  expect(count("step_ingredient")).toBe(4);

  // Dropping the ingredient row from the document takes the two links naming it.
  const trimmed = recipeInputSchema.parse(created);
  trimmed.parts[0]!.ingredients = trimmed.parts[0]!.ingredients.filter((i) => i.id !== ids.ing1);
  const updated = repo.ref(created.id).replace(trimmed)!;
  expect(updated.parts[0]!.steps.map((s) => s.ingredientIds)).toEqual([[ids.ing2], []]);
  expect(count("step_ingredient")).toBe(2);

  expect(repo.remove(created.id)).toBe(true);
  expect(count("step_ingredient")).toBe(0);
});

// --- Restyle (M37.5) ---------------------------------------------------------
// `ref(id).restyle` and `ref(id).restore` are the only writes that touch steps
// without touching the rest of the document, so they are tested against the
// table rather than only through the document: `source_steps` is written once
// and never again, and it is the column a restore reads.

/** The kept original steps of each part, in position order, as stored. */
function sourceSteps(): (string[] | null)[] {
  return db
    .query<{ source_steps: string | null }, []>("SELECT source_steps FROM part ORDER BY position")
    .all()
    .map((row) => (row.source_steps === null ? null : (JSON.parse(row.source_steps) as string[])));
}

/** The restyled answer for `fullDoc`'s three parts: the same parts, rewritten steps. */
const restyled = [
  { name: "Pasta", steps: ["Bring a pot to the boil.", "Cook the spaghetti until it still has bite."] },
  { name: "Sauce", steps: ["Melt the cold butter over a low heat."] },
  { name: "", steps: ["Toss the two together and serve."] },
];

test("a restyle keeps the author's steps, replaces the steps and links the new ones", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));

  const after = repo.ref(created.id).restyle(restyled)!;

  expect(after.parts.map((p) => p.steps.map((s) => s.text))).toEqual(restyled.map((p) => p.steps));
  // Fresh rows: a rewritten step is not the step it replaced.
  expect(after.parts.flatMap((p) => p.steps.map((s) => s.id))).not.toContain(ids.step1);
  // The author's words, in position order, kept exactly once each.
  expect(sourceSteps()).toEqual([["Boil the pasta."], ["Melt the butter."], ["Toss together and serve."]]);
  // The step card keeps its rows: the links are suggested over the new text.
  expect(after.parts[0]!.steps.map((s) => s.ingredientIds)).toEqual([[], [ids.ing1]]);
  expect(after.parts[1]!.steps[0]!.ingredientIds).toEqual([ids.ing3]);
  expect(count("step_ingredient")).toBe(2);
  // Stamped, and the recipe reads as changed.
  expect(after.restyledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(recipeSchema.parse(after)).toEqual(after);
  expect(repo.get(created.slug)).toEqual(after);
});

test("a second restyle leaves the kept original alone: it is the author's, not the last rewrite", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  repo.ref(created.id).restyle(restyled);

  const again = repo.ref(created.id).restyle([
    { name: "Pasta", steps: ["Boil salted water, then cook the spaghetti."] },
    { name: "Sauce", steps: ["Melt the butter."] },
    { name: "", steps: ["Serve."] },
  ])!;

  expect(again.parts[0]!.steps.map((s) => s.text)).toEqual(["Boil salted water, then cook the spaghetti."]);
  expect(sourceSteps()).toEqual([["Boil the pasta."], ["Melt the butter."], ["Toss together and serve."]]);
});

test("restoring puts the author's words back, re-links them and clears the stamp", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  repo.ref(created.id).restyle(restyled);

  const restored = repo.ref(created.id).restore()!;

  expect(restored.parts.map((p) => p.steps.map((s) => s.text))).toEqual([["Boil the pasta."], ["Melt the butter."], ["Toss together and serve."]]);
  expect(restored.restyledAt).toBeNull();
  expect(sourceSteps()).toEqual([null, null, null]);
  // Links again, over the restored text this time.
  expect(restored.parts[1]!.steps[0]!.ingredientIds).toEqual([ids.ing3]);
  // Nothing but the steps moved: ingredients, notes and tags are as created.
  expect(restored.parts.map((p) => p.ingredients)).toEqual(created.parts.map((p) => p.ingredients));
  expect(restored.notes).toEqual(created.notes);
  expect(restored.tags).toEqual(created.tags);
});

test("restoring a recipe nobody restyled changes nothing", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));

  const restored = repo.ref(created.id).restore()!;

  expect({ ...restored, updatedAt: created.updatedAt }).toEqual(created);
  expect(sourceSteps()).toEqual([null, null, null]);
});

test("a restyle answering with the wrong number of parts throws and writes nothing", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));

  expect(() => repo.ref(created.id).restyle(restyled.slice(0, 2))).toThrow(/2 parts where the recipe has 3/);
  expect(repo.getById(created.id)).toEqual(created);
  expect(sourceSteps()).toEqual([null, null, null]);
});

test("an ordinary edit keeps the author's steps and the stamp", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  const after = repo.ref(created.id).restyle(restyled)!;

  // The editor saves what it loaded, with one field changed; it never sends
  // either of the restyle's columns.
  const edited = repo.ref(created.id).replace(recipeInputSchema.parse({ ...after, description: "Edited." }))!;

  expect(edited.description).toBe("Edited.");
  expect(edited.restyledAt).toBe(after.restyledAt);
  expect(sourceSteps()).toEqual([["Boil the pasta."], ["Melt the butter."], ["Toss together and serve."]]);
  // And a restore after the edit still reaches the author's words.
  expect(
    repo
      .ref(created.id)
      .restore()!
      .parts[0]!.steps.map((s) => s.text)
  ).toEqual(["Boil the pasta."]);
});

test("a part the editor adds after a restyle has no original of its own", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  const after = repo.ref(created.id).restyle(restyled)!;

  const doc = recipeInputSchema.parse(after);
  doc.parts.push({ name: "To serve", ingredients: [], steps: [{ text: "Grate over parmesan.", ingredientIds: [], image: null }] });
  repo.ref(created.id).replace(doc);

  expect(sourceSteps()).toEqual([["Boil the pasta."], ["Melt the butter."], ["Toss together and serve."], null]);
});
