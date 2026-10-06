import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "../../../src/db/connection/open";
import { migrate } from "../../../src/db/migrations/migrate";
import { aisleRepository } from "../../../src/db/models/aisle/repo";
import { foodRepository } from "../../../src/db/models/food/repo";
import { correctedStarterFoods, FOOD_PLURALS } from "../../../src/db/seed/foodPlurals";
import { STARTER_AISLES, STARTER_FOODS, type StarterFood } from "../../../src/db/seed/foods";
import { seed } from "../../../src/db/seed/seed";
import { seedFoodPlurals, seedStarterFoods } from "../../../src/db/seed/starter";
import { DEFAULT_UNITS } from "../../../src/db/seed/units";
import { parseIngredient } from "../../../src/domain/ingredient";

let db: Database;
beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
});

const wordsOf = (food: StarterFood) => [food.name, food.plural, ...(food.aliases ?? [])].filter((word): word is string => word !== undefined);

describe.each([
  ["the first batch", STARTER_FOODS],
  ["the list a new database ends up with", correctedStarterFoods()],
] as const)("%s", (_label, STARTER_FOODS: readonly StarterFood[]) => {
  test("every food sits in a starter aisle, and every aisle has a food", () => {
    const aisles = new Set<string>(STARTER_AISLES);
    expect(STARTER_FOODS.filter((food) => !aisles.has(food.aisle))).toEqual([]);
    expect(STARTER_AISLES.filter((aisle) => !STARTER_FOODS.some((food) => food.aisle === aisle))).toEqual([]);
  });

  // The matcher cuts a line at its first comma and reads a leading number as
  // the amount, so a word with either in it could never be matched.
  test("every name, plural and alias is lower case, trimmed, and one the matcher can reach", () => {
    const unreachable = STARTER_FOODS.flatMap(wordsOf).filter((word) => word !== word.trim().toLowerCase() || /[,/()]/.test(word) || /^\d/.test(word));
    expect(unreachable).toEqual([]);
  });

  test("no word reads as two foods", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const food of STARTER_FOODS) {
      for (const word of new Set(wordsOf(food))) {
        const other = owner.get(word);
        if (other !== undefined && other !== food.name) clashes.push(`${word}: ${other}, ${food.name}`);
        owner.set(word, food.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  test("only water and the salt-and-pepper line skip the shopping list", () => {
    expect(STARTER_FOODS.filter((food) => food.skipShopping).map((food) => food.name)).toEqual(["salt and pepper", "water"]);
  });
});

describe("reading lines against it", () => {
  const units = DEFAULT_UNITS.map((unit) => ({ name: unit.name, pluralName: unit.pluralName ?? null, abbreviation: unit.abbreviation ?? "" }));
  const foods = correctedStarterFoods().map((food) => ({ name: food.name, pluralName: food.plural ?? null, aliases: [...(food.aliases ?? [])] }));
  const foodOf = (line: string) => parseIngredient(line, { units, foods }).food?.name ?? null;

  // A compound is a food of its own so its head never swallows it: with only
  // "lemon" in the list, "lemon juice" would be a lemon and the juice gone.
  test.each([
    ["2 tbsp lemon juice", "lemon juice"],
    ["1 tsp finely grated lemon zest", "lemon zest"],
    ["1 tsp garlic powder", "garlic powder"],
    ["3 egg yolks", "egg yolk"],
    ["2 egg whites", "egg white"],
    ["1/2 tsp celery salt", "celery salt"],
    ["1 can butter beans, drained", "butter beans"],
    ["100g milk chocolate, chopped", "milk chocolate"],
    ["1 tsp coriander seeds", "coriander seeds"],
    ["1 tsp coriander powder", "ground coriander"],
    ["2 cups chicken stock", "chicken stock"],
    ["2 tsp red pepper flakes", "chilli flakes"],
    ["2 scotch bonnet chillies", "habanero chilli"],
    ["1 tbsp rice wine", "chinese cooking wine"],
  ])("%s reads as %s", (line, food) => {
    expect(foodOf(line)).toBe(food);
  });

  test.each([
    ["1/2 cup cilantro, chopped", "coriander"],
    ["3 scallions, sliced", "spring onion"],
    ["2 cups all-purpose flour", "plain flour"],
    ["1 tsp baking soda", "bicarbonate of soda"],
    ["2 tbsp cornstarch", "cornflour"],
    ["1 cup heavy cream", "thickened cream"],
    ["1 aubergine, cubed", "eggplant"],
    ["2 courgettes", "zucchini"],
    ["500g shrimp, peeled", "prawn"],
    ["1 red bell pepper", "red capsicum"],
    ["2 tbsp tomato purée", "tomato paste"],
    ["1/2 cup confectioners sugar", "icing sugar"],
    ["1 cup arugula", "rocket"],
    ["100g fetta, crumbled", "feta"],
    ["1 cup plain yogurt", "natural yoghurt"],
  ])("%s, the US or UK word, reads as %s", (line, food) => {
    expect(foodOf(line)).toBe(food);
  });

  test.each([
    ["1 onion, diced", "onion"],
    ["2 cloves garlic, minced", "garlic"],
    ["1 tbsp extra virgin olive oil", "extra virgin olive oil"],
    ["800g canned crushed tomatoes", "canned tomatoes"],
    ["Salt and pepper", "salt and pepper"],
    ["1 cup boiling water", "water"],
    ["2 tsp cooking salt / kosher salt", "salt"],
  ])("%s reads as %s", (line, food) => {
    expect(foodOf(line)).toBe(food);
  });
});

describe("seeding", () => {
  test("a new database gets every starter aisle, in walking order, and every starter food in its aisle", () => {
    const { aisles, foods } = seed(db);
    expect(aisles.map((aisle) => aisle.name)).toEqual([...STARTER_AISLES]);
    expect(
      aisleRepository(db)
        .list()
        .map((aisle) => aisle.name)
    ).toEqual([...STARTER_AISLES]);
    expect(foods).toHaveLength(STARTER_FOODS.length);

    const repo = foodRepository(db);
    const lemonJuice = repo.getByName("lemon juice")!;
    expect(lemonJuice.aisleId).toBe(aisles.find((aisle) => aisle.name === "Fruit & veg")!.id);
    expect(repo.getByName("spring onion")).toMatchObject({ pluralName: "spring onions", aliases: expect.arrayContaining(["scallion", "green onion"]) });
    expect(repo.getByName("water")).toMatchObject({ skipShopping: true });
    expect(repo.getByName("flat-leaf parsley")).toMatchObject({ pluralName: null, skipShopping: false });
  });

  test("the batch goes in once: a second start adds nothing, and a deleted or renamed food stays as the household left it", () => {
    seed(db);
    const repo = foodRepository(db);
    const onion = repo.getByName("onion")!;
    repo.remove(onion.id);
    const flour = repo.getByName("plain flour")!;
    repo.update(flour.id, { name: "flour" });

    const second = seed(db);
    expect(second.aisles).toEqual([]);
    expect(second.foods).toEqual([]);
    expect(second.aliasedFoods).toEqual([]);
    expect(second.correctedFoods).toEqual([]);
    expect(repo.getByName("onion")).toBeNull();
    expect(repo.getByName("plain flour")).toBeNull();
    expect(repo.getByName("flour")!.id).toBe(flour.id);
    expect(repo.list()).toHaveLength(STARTER_FOODS.length - 1);
  });

  test("an existing aisle is reused whatever its case, and the missing ones follow it", () => {
    const aisles = aisleRepository(db);
    const mine = aisles.create({ name: "fruit & VEG" });
    const other = aisles.create({ name: "Frozen things" });
    const { aisles: made } = seedStarterFoods(db);

    expect(made.map((aisle) => aisle.name)).toEqual(STARTER_AISLES.filter((name) => name !== "Fruit & veg"));
    expect(aisles.list()[0]).toEqual(mine);
    expect(aisles.list()[1]).toEqual(other);
    expect(foodRepository(db).getByName("lemon")!.aisleId).toBe(mine.id);
  });

  test("the household's food keeps every word it answers to", () => {
    const repo = foodRepository(db);
    // The household calls it cilantro, and has a food of its own for brown onions.
    const cilantro = repo.create({ name: "Cilantro" });
    const brown = repo.create({ name: "brown onion", pluralName: "brown onions" });
    const spud = repo.create({ name: "spud", aliases: ["potatoes"] });
    seedStarterFoods(db);

    expect(repo.get(cilantro.id)).toEqual(cilantro);
    expect(repo.get(brown.id)).toEqual(brown);
    expect(repo.get(spud.id)).toEqual(spud);
    // The starter foods go in beside them, minus the words already taken.
    expect(repo.getByName("coriander")!.aliases).not.toContain("cilantro");
    expect(repo.getByName("onion")!.aliases).not.toContain("brown onion");
    expect(repo.getByName("onion")!.aliases).toContain("yellow onion");
    expect(repo.getByName("potato")!.pluralName).toBeNull();
  });

  test("a starter food whose name an existing food answers to is not added", () => {
    const repo = foodRepository(db);
    const mine = repo.create({ name: "chook", aliases: ["whole chicken"] });
    seedStarterFoods(db);
    expect(repo.getByName("whole chicken")).toBeNull();
    expect(repo.get(mine.id)).toEqual(mine);
  });

  test("an existing food with a starter food's own name gains the words nothing else claims", () => {
    const repo = foodRepository(db);
    const garlic = repo.create({ name: "Garlic", aliases: ["garlic bulb"] });
    const clove = repo.create({ name: "garlic clove" });
    const { foods, aliasedFoods } = seedStarterFoods(db);

    expect(foods.map((food) => food.name)).not.toContain("garlic");
    expect(aliasedFoods.map((food) => food.id)).toEqual([garlic.id]);
    const after = repo.get(garlic.id)!;
    expect(after.name).toBe("Garlic");
    expect(after.aliases[0]).toBe("garlic bulb");
    expect(after.aliases).toContain("minced garlic");
    expect(after.aliases).not.toContain("garlic clove");
    expect(repo.get(clove.id)).toEqual(clove);
  });
});

describe("the plurals batch", () => {
  test("a new database ends up with the corrected list, word for word", () => {
    seed(db);
    const stored = foodRepository(db)
      .list()
      .map((food) => ({ name: food.name, plural: food.pluralName, aliases: [...food.aliases].sort() }));
    const expected = correctedStarterFoods().map((food) => ({ name: food.name, plural: food.plural ?? null, aliases: [...(food.aliases ?? [])].sort() }));
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect(stored.sort(byName)).toEqual(expected.sort(byName));
  });

  test("a database that had only the first batch is corrected: renamed, given a plural, given aliases", () => {
    seedStarterFoods(db);
    const repo = foodRepository(db);
    const teaBags = repo.getByName("tea bags")!;
    const changed = seedFoodPlurals(db);

    expect(changed.map((food) => food.name)).toEqual(expect.arrayContaining(["tea bag", "lobster", "beetroot", "long red chilli"]));
    expect(repo.get(teaBags.id)).toMatchObject({ name: "tea bag", pluralName: "tea bags" });
    expect(repo.get(teaBags.id)!.aliases).not.toContain("tea bag");
    expect(repo.getByName("lobster")!.pluralName).toBe("lobsters");
    expect(repo.getByName("beetroot")!.pluralName).toBeNull();
    expect(repo.getByName("long red chilli")!.aliases).toContain("fresh chillies");
    expect(parseIngredient("2 fresh chillies", { units: [], foods: repo.list() }).food?.name).toBe("long red chilli");
  });

  test("it goes in once", () => {
    seed(db);
    const repo = foodRepository(db);
    const teaBag = repo.getByName("tea bag")!;
    repo.update(teaBag.id, { name: "tea bags", pluralName: null });
    expect(seedFoodPlurals(db)).toEqual([]);
    expect(repo.get(teaBag.id)!.name).toBe("tea bags");
  });

  test("the household's choices win: a renamed, deleted or re-pluralled food is left as it is", () => {
    seedStarterFoods(db);
    const repo = foodRepository(db);
    const gherkins = repo.getByName("gherkins")!;
    repo.update(gherkins.id, { name: "pickles" });
    repo.remove(repo.getByName("lobster")!.id);
    const beetroot = repo.getByName("beetroot")!;
    repo.update(beetroot.id, { pluralName: "beets" });
    const marshmallows = repo.getByName("marshmallows")!;
    repo.update(marshmallows.id, { pluralName: "mallows" });

    seedFoodPlurals(db);
    expect(repo.get(gherkins.id)).toMatchObject({ name: "pickles" });
    expect(repo.getByName("lobster")).toBeNull();
    expect(repo.get(beetroot.id)!.pluralName).toBe("beets");
    // Renamed to the singular, but the household's own plural stays.
    expect(repo.get(marshmallows.id)).toMatchObject({ name: "marshmallow", pluralName: "mallows" });
  });

  test("a rename another food already answers to is skipped, and so is an alias another food has", () => {
    seedStarterFoods(db);
    const repo = foodRepository(db);
    const mine = repo.create({ name: "my tea", aliases: ["tea bag"] });
    repo.update(repo.getByName("tea bags")!.id, { aliases: [] });
    const chilli = repo.create({ name: "fresh chilli mix", aliases: ["fresh chillies"] });

    seedFoodPlurals(db);
    expect(repo.getByName("tea bags")).not.toBeNull();
    expect(repo.getByName("tea bag")).toBeNull();
    expect(repo.get(mine.id)).toEqual(mine);
    expect(repo.getByName("long red chilli")!.aliases).not.toContain("fresh chillies");
    expect(repo.get(chilli.id)).toEqual(chilli);
  });

  test("every correction names a first-batch food", () => {
    const names = new Set(STARTER_FOODS.map((food) => food.name));
    expect(FOOD_PLURALS.filter((correction) => !names.has(correction.name)).map((correction) => correction.name)).toEqual([]);
  });
});
