// Recipe repository against :memory: with the real migration: round-trip of a
// full document, update replacing children, delete cascading, list filters.
import type { Database } from "bun:sqlite";
import { beforeEach, expect, test } from "vitest";
import { migrate, openDatabase } from "../../src/db/migrate";
import { recipes, type RecipeRepository } from "../../src/db/recipes";
import { recipeInputSchema, recipeSchema, recipeSummarySchema, type RecipeInput } from "../../src/domain/recipe";

let db: Database;
let repo: RecipeRepository;
beforeEach(async () => {
  db = openDatabase(":memory:");
  await migrate(db);
  repo = recipes(db);
});

function count(table: string): number {
  return db.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table}`).get()!.n;
}

const ids = {
  recipe: "11111111-1111-4111-8111-111111111111",
  pasta: "22222222-2222-4222-8222-222222222222",
  sauce: "33333333-3333-4333-8333-333333333333",
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
};
const spaghetti = { id: ids.spaghetti, name: "spaghetti", pluralName: "spaghetti", aliases: [], aisle: null, recipeId: null, skipShopping: false };
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
  components: [
    {
      id: ids.pasta,
      name: "Pasta",
      ingredients: [
        { id: ids.ing1, quantity: 200, unit: gram, food: spaghetti, note: "", originalText: "200 g spaghetti", fixed: false },
        { id: ids.ing2, quantity: null, unit: null, food: null, note: "to taste", originalText: "salt, to taste", fixed: false },
      ],
      steps: [{ id: ids.step1, text: "Boil the pasta." }],
    },
    {
      id: ids.sauce,
      name: "Sauce",
      ingredients: [{ id: ids.ing3, quantity: 50, unit: gram, food: butter, note: "cold", originalText: "50 g cold butter", fixed: true }],
      steps: [{ id: ids.step2, text: "Melt the butter." }],
    },
  ],
  steps: [{ id: ids.step3, text: "Toss together and serve." }],
};

const minimal = (name: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  name,
  components: [{ name: "", ingredients: [], steps: [] }],
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
  const foodByName = Object.fromEntries(created.components.flatMap((c) => c.ingredients).filter((i) => i.food).map((i) => [i.food!.name, i.food!]));
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
    yieldUnit: g,
    tags: [tagByName.Pasta, tagByName.Weeknight],
    components: expected.components.map((c) => ({
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
  const again = repo.update(created.id, recipeInputSchema.parse(created))!;
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
        components: [
          {
            name: "",
            ingredients: [{ quantity: 10, unit: { ...gram, id: crypto.randomUUID(), name: " Gram " }, food: { ...butter, id: crypto.randomUUID(), name: "Butter" }, note: "", originalText: "", fixed: false }],
            steps: [],
          },
        ],
      }),
    ),
  );

  expect(count("unit")).toBe(1);
  expect(count("food")).toBe(2);
  expect(count("tag")).toBe(2);
  expect(second.yieldUnit).toEqual(g);
  expect(second.components[0]!.ingredients[0]!.unit).toEqual(g);
  expect(second.components[0]!.ingredients[0]!.food!.name).toBe("butter");
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

  const updated = repo.update(
    created.id,
    recipeInputSchema.parse({
      ...fullDoc,
      description: "Now flat.",
      rating: 5,
      tags: [weeknight],
      notes: [],
      components: [
        {
          name: "",
          ingredients: [{ quantity: 1, unit: null, food: { ...butter, id: crypto.randomUUID(), name: "Parmesan" }, note: "", originalText: "a handful of parmesan", fixed: false }],
          steps: [{ id: ids.step1, text: "Grate." }],
        },
      ],
      steps: [{ text: "Serve." }, { text: "Eat." }],
    }),
  )!;

  expect(updated.id).toBe(created.id);
  expect(updated.slug).toBe("butter-pasta");
  expect(updated.createdAt).toBe(created.createdAt);
  expect(updated.updatedAt >= created.updatedAt).toBe(true);
  expect(updated.description).toBe("Now flat.");
  expect(updated.rating).toBe(5);
  expect(updated.notes).toEqual([]);
  expect(updated.tags.map((t) => t.name)).toEqual(["Weeknight"]);
  expect(updated.components).toHaveLength(1);
  expect(updated.components[0]!.name).toBe("");
  expect(updated.components[0]!.ingredients).toHaveLength(1);
  expect(updated.components[0]!.ingredients[0]!.food!.name).toBe("Parmesan");
  expect(updated.components[0]!.steps).toEqual([{ id: ids.step1, text: "Grate." }]);
  expect(updated.steps.map((s) => s.text)).toEqual(["Serve.", "Eat."]);

  // Old children are gone from the tables, not just from the document.
  expect(count("component")).toBe(1);
  expect(count("ingredient")).toBe(1);
  expect(count("step")).toBe(3);
  expect(count("recipe_note")).toBe(0);
  expect(count("recipe_tag")).toBe(1);
  // References survive an update that stops using them.
  expect(count("food")).toBe(3);
  expect(count("tag")).toBe(2);
  expect(count("unit")).toBe(1);

  expect(repo.get("butter-pasta")).toEqual(updated);
  expect(repo.update("missing", recipeInputSchema.parse(minimal("x")))).toBeNull();
});

test("update regenerates the slug only when the name changes", () => {
  repo.create(recipeInputSchema.parse(minimal("Toast-2")));
  const created = repo.create(recipeInputSchema.parse(minimal("Toast")));
  expect(created.slug).toBe("toast");

  expect(repo.update(created.id, recipeInputSchema.parse(minimal("Toast", { description: "same name" })))!.slug).toBe("toast");
  const renamed = repo.update(created.id, recipeInputSchema.parse(minimal("Toast 2")))!;
  expect(renamed.slug).toBe("toast-2-2"); // "toast-2" is taken by the other recipe
  expect(repo.get("toast")).toBeNull();
  expect(repo.get("toast-2-2")!.id).toBe(created.id);
  // Renaming back reclaims the free slug rather than suffixing against itself.
  expect(repo.update(created.id, recipeInputSchema.parse(minimal("Toast")))!.slug).toBe("toast");
});

test("a failing write leaves the previous recipe intact", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  const bad = recipeInputSchema.parse({ ...fullDoc, description: "broken" });
  // Duplicate child id inside one document violates the primary key mid-transaction.
  bad.steps = [{ id: ids.step1, text: "dup" }];

  expect(() => repo.update(created.id, bad)).toThrow(/UNIQUE|PRIMARY/);
  expect(repo.get("butter-pasta")).toEqual(created);
  expect(count("recipe")).toBe(1);

  expect(() => repo.create(recipeInputSchema.parse({ ...minimal("Broken"), steps: [{ id: ids.step1, text: "dup" }] }))).toThrow(/UNIQUE|PRIMARY/);
  expect(count("recipe")).toBe(1);
  expect(count("component")).toBe(2);
});

test("remove cascades to every child and leaves references", () => {
  const created = repo.create(recipeInputSchema.parse(fullDoc));
  repo.create(recipeInputSchema.parse(minimal("Other", { tags: [weeknight] })));

  expect(repo.remove(created.id)).toBe(true);
  expect(repo.remove(created.id)).toBe(false);

  expect(repo.get("butter-pasta")).toBeNull();
  expect(count("recipe")).toBe(1);
  expect(count("component")).toBe(1);
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

  const all = repo.list();
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
  });
  expect(bySlug["pumpkin-soup"]!.rating).toBe(3);
  expect(bySlug["pumpkin-soup"]!.tags).toEqual([]);

  expect(repo.list({ q: "PAST" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ q: "s" }).map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast", "pumpkin-soup"]);
  expect(repo.list({ q: "   " }).length).toBe(3);
  expect(repo.list({ q: "nothing" })).toEqual([]);

  expect(repo.list({ tag: "weeknight" }).map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast"]);
  expect(repo.list({ tag: "pasta" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ tag: "weeknight", q: "toast" }).map((r) => r.slug)).toEqual(["cheese-toast"]);
  expect(repo.list({ tag: "missing" })).toEqual([]);
  expect(soup.tags).toEqual([]);
});

test("list filters by tags[] with any (default) and all match", () => {
  repo.create(recipeInputSchema.parse(fullDoc)); // tags: Pasta, Weeknight
  repo.create(recipeInputSchema.parse(minimal("Cheese Toast", { tags: [weeknight] })));
  repo.create(recipeInputSchema.parse(minimal("Pumpkin soup")));

  // any: either tag.
  expect(repo.list({ tags: ["pasta", "weeknight"] }).map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast"]);
  expect(repo.list({ tags: ["pasta", "weeknight"], match: "any" }).map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast"]);
  // all: only the recipe carrying every tag.
  expect(repo.list({ tags: ["pasta", "weeknight"], match: "all" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ tags: ["missing"] })).toEqual([]);
  // The legacy singular `tag` folds into the set alongside `tags`.
  expect(repo.list({ tag: "weeknight", tags: ["pasta"], match: "all" }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ tag: "weeknight", tags: ["weeknight"] }).map((r) => r.slug).sort()).toEqual(["butter-pasta", "cheese-toast"]); // de-duplicated, not doubled
});

test("list filters by foods[]", () => {
  const full = repo.create(recipeInputSchema.parse(fullDoc)); // Pasta: spaghetti, salt; Sauce: butter
  repo.create(recipeInputSchema.parse(minimal("Cheese Toast")));
  const spaghettiId = full.components[0]!.ingredients[0]!.food!.id;
  const butterId = full.components[1]!.ingredients[0]!.food!.id;

  expect(repo.list({ foods: [spaghettiId] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ foods: [butterId] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ foods: [spaghettiId, crypto.randomUUID()] }).map((r) => r.slug)).toEqual(["butter-pasta"]);
  expect(repo.list({ foods: [crypto.randomUUID()] })).toEqual([]);
});

test("list filters by favourite", () => {
  repo.create(recipeInputSchema.parse(minimal("Fav", { favourite: true })));
  repo.create(recipeInputSchema.parse(minimal("Not fav")));

  expect(repo.list({ favourite: true }).map((r) => r.slug)).toEqual(["fav"]);
  expect(repo.list({ favourite: false }).map((r) => r.slug).sort()).toEqual(["fav", "not-fav"]);
  expect(repo.list().map((r) => r.slug).sort()).toEqual(["fav", "not-fav"]);
});

test("list orders newest first", () => {
  const a = repo.create(recipeInputSchema.parse(minimal("A")));
  db.run("UPDATE recipe SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  const b = repo.create(recipeInputSchema.parse(minimal("B")));
  expect(repo.list().map((r) => r.id)).toEqual([b.id, a.id]);
});

test("list sorts by name, created and updated in both directions (M12.4)", () => {
  const b = repo.create(recipeInputSchema.parse(minimal("Banana cake")));
  const a = repo.create(recipeInputSchema.parse(minimal("Apple pie")));
  const c = repo.create(recipeInputSchema.parse(minimal("Carrot soup")));

  expect(repo.list({ sort: "name", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "banana-cake", "carrot-soup"]);
  expect(repo.list({ sort: "name", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "banana-cake", "apple-pie"]);
  // Omitted dir defaults per key: name reads ascending.
  expect(repo.list({ sort: "name" }).map((r) => r.slug)).toEqual(["apple-pie", "banana-cake", "carrot-soup"]);

  db.run("UPDATE recipe SET created_at = '2020-06-01T00:00:00.000Z' WHERE id = ?", [b.id]);
  db.run("UPDATE recipe SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  db.run("UPDATE recipe SET created_at = '2020-03-01T00:00:00.000Z' WHERE id = ?", [c.id]);
  expect(repo.list({ sort: "created", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.list({ sort: "created", dir: "desc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  // Omitted sort/dir keeps the original newest-created-first order.
  expect(repo.list().map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  // Omitted dir defaults per key: created reads newest first.
  expect(repo.list({ sort: "created" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);

  db.run("UPDATE recipe SET updated_at = '2021-06-01T00:00:00.000Z' WHERE id = ?", [b.id]);
  db.run("UPDATE recipe SET updated_at = '2021-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
  db.run("UPDATE recipe SET updated_at = '2021-03-01T00:00:00.000Z' WHERE id = ?", [c.id]);
  expect(repo.list({ sort: "updated", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.list({ sort: "updated", dir: "desc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
});

test("list sorts by lastMade and rating, nulls last regardless of direction (M12.4)", () => {
  repo.create(recipeInputSchema.parse(minimal("Banana cake", { rating: 3 }))); // no lastMade
  repo.create(recipeInputSchema.parse(minimal("Apple pie", { lastMade: "2026-01-01T00:00:00.000Z" }))); // no rating
  repo.create(recipeInputSchema.parse(minimal("Carrot soup", { rating: 5, lastMade: "2026-06-01T00:00:00.000Z" })));

  expect(repo.list({ sort: "lastMade", dir: "asc" }).map((r) => r.slug)).toEqual(["apple-pie", "carrot-soup", "banana-cake"]);
  expect(repo.list({ sort: "lastMade", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "apple-pie", "banana-cake"]);

  expect(repo.list({ sort: "rating", dir: "asc" }).map((r) => r.slug)).toEqual(["banana-cake", "carrot-soup", "apple-pie"]);
  expect(repo.list({ sort: "rating", dir: "desc" }).map((r) => r.slug)).toEqual(["carrot-soup", "banana-cake", "apple-pie"]);
});

test("list sort random is stable for a given seed, reshuffles for a different one, and keeps the same rows (M12.4)", () => {
  const created = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name) => repo.create(recipeInputSchema.parse(minimal(name))));

  const first = repo.list({ sort: "random", seed: "seed-a" }).map((r) => r.id);
  const again = repo.list({ sort: "random", seed: "seed-a" }).map((r) => r.id);
  expect(again).toEqual(first);
  expect(first.slice().sort()).toEqual(created.map((r) => r.id).sort());

  const other = repo.list({ sort: "random", seed: "seed-b" }).map((r) => r.id);
  expect(other).not.toEqual(first);

  // A filter still applies before the shuffle.
  expect(repo.list({ sort: "random", seed: "seed-a", q: "alp" }).map((r) => r.slug)).toEqual(["alpha"]);
});

test("setImage changes only the image column and reports whether the id exists", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { description: "Bread, heated." })));
  expect(created.image).toBeNull();

  expect(repo.setImage(created.id, `${created.id}.png`)).toBe(true);
  const after = repo.getById(created.id)!;
  expect(after.image).toBe(`${created.id}.png`);
  expect({ ...after, image: null, updatedAt: created.updatedAt }).toEqual(created);

  expect(repo.setImage(created.id, null)).toBe(true);
  expect(repo.getById(created.id)!.image).toBeNull();
  expect(repo.setImage(ids.recipe, "x.png")).toBe(false);
});

test("favourite round-trips through create, update and the list summary", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { favourite: true })));
  expect(created.favourite).toBe(true);
  expect(repo.list().find((r) => r.id === created.id)!.favourite).toBe(true);

  const updated = repo.update(created.id, recipeInputSchema.parse(minimal("Toast", { favourite: false })))!;
  expect(updated.favourite).toBe(false);
});

test("setFavourite changes only the favourite column and reports whether the id exists", () => {
  const created = repo.create(recipeInputSchema.parse(minimal("Toast", { description: "Bread, heated." })));
  expect(created.favourite).toBe(false);

  expect(repo.setFavourite(created.id, true)).toBe(true);
  const after = repo.getById(created.id)!;
  expect(after.favourite).toBe(true);
  expect({ ...after, favourite: false }).toEqual(created);
  expect(repo.list().find((r) => r.id === created.id)!.favourite).toBe(true);

  expect(repo.setFavourite(created.id, false)).toBe(true);
  expect(repo.getById(created.id)!.favourite).toBe(false);
  expect(repo.setFavourite(ids.recipe, true)).toBe(false);
});
