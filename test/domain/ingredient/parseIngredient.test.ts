import { describe, expect, test } from "vitest";
import { formatIngredient, type DisplayIngredient } from "../../../src/domain/ingredient/format";
import { parseIngredient, type Vocabulary } from "../../../src/domain/ingredient/parseIngredient";
import type { FoodCandidate } from "../../../src/domain/ingredient/parseFood";
import type { UnitCandidate } from "../../../src/domain/ingredient/parseUnit";
import type { Food, Unit } from "../../../src/domain/recipe/recipe";
import { generateDevRecipes } from "../../../src/db/dev/generate";
import { SAMPLE_RECIPES } from "../../../src/db/seed/recipes";

const unit = (name: string, pluralName: string | null, abbreviation: string): UnitCandidate => ({
  name,
  pluralName,
  abbreviation,
});

const food = (name: string, pluralName: string | null = null, aliases: string[] = []): FoodCandidate => ({
  name,
  pluralName,
  aliases,
});

const CUP = unit("cup", "cups", "cup");
const TEASPOON = unit("teaspoon", "teaspoons", "tsp");
const TABLESPOON = unit("tablespoon", "tablespoons", "tbsp");
const GRAM = unit("gram", "grams", "g");
const BUNCH = unit("bunch", "bunches", "bunch");
const PINCH = unit("pinch", "pinches", "pinch");

const FLOUR = food("plain flour");
const SALT = food("salt");
const CORIANDER = food("coriander", null, ["cilantro"]);
const CHICKEN_BREAST = food("chicken breast", "chicken breasts");
const ROSEMARY = food("rosemary");
const BANANA = food("banana", "bananas");

const VOCABULARY: Vocabulary<UnitCandidate, FoodCandidate> = {
  units: [CUP, TEASPOON, TABLESPOON, GRAM, BUNCH, PINCH],
  foods: [FLOUR, SALT, CORIANDER, CHICKEN_BREAST, ROSEMARY, BANANA],
};

const parse = (line: string) => parseIngredient(line, VOCABULARY);

describe("parseIngredient", () => {
  describe("end to end", () => {
    test("2 cups plain flour, sifted", () => {
      expect(parse("2 cups plain flour, sifted")).toEqual({
        quantity: 2,
        fixed: false,
        unit: CUP,
        unitText: "cups",
        food: FLOUR,
        foodText: "",
        note: "sifted",
        originalText: "2 cups plain flour, sifted",
      });
    });

    test("=1 tsp salt", () => {
      expect(parse("=1 tsp salt")).toEqual({
        quantity: 1,
        fixed: true,
        unit: TEASPOON,
        unitText: "tsp",
        food: SALT,
        foodText: "",
        note: "",
        originalText: "=1 tsp salt",
      });
    });

    test("salt, to taste", () => {
      expect(parse("salt, to taste")).toEqual({
        quantity: null,
        fixed: false,
        unit: null,
        unitText: "",
        food: SALT,
        foodText: "",
        note: "to taste",
        originalText: "salt, to taste",
      });
    });

    test("½ bunch coriander, chopped", () => {
      expect(parse("½ bunch coriander, chopped")).toEqual({
        quantity: 0.5,
        fixed: false,
        unit: BUNCH,
        unitText: "bunch",
        food: CORIANDER,
        foodText: "",
        note: "chopped",
        originalText: "½ bunch coriander, chopped",
      });
    });

    test("a parenthetical joins the note, wherever it falls", () => {
      expect(parse("2 chicken breasts (about 400 g), diced")).toMatchObject({
        quantity: 2,
        unit: null,
        unitText: "",
        food: CHICKEN_BREAST,
        foodText: "",
        note: "about 400 g, diced",
      });
    });

    test("an alias matches the food", () => {
      expect(parse("1 bunch cilantro")).toMatchObject({ unit: BUNCH, food: CORIANDER, foodText: "" });
    });

    test("a line with an amount but no unit keeps the food", () => {
      expect(parse("250 g plain flour")).toMatchObject({ quantity: 250, unit: GRAM, unitText: "g", food: FLOUR });
    });
  });

  describe("misses report their text rather than inventing a row", () => {
    test("an unknown food keeps the whole candidate", () => {
      expect(parse("2 cups semolina, sifted")).toMatchObject({
        unit: CUP,
        food: null,
        foodText: "semolina",
        note: "sifted",
      });
    });

    test("an adjective in front of a known food is not dropped", () => {
      expect(parse("200 g strong plain flour")).toMatchObject({ food: null, foodText: "strong plain flour" });
    });

    test("nothing matches at all", () => {
      expect(parse("a good splash of whatever wine is open")).toMatchObject({
        quantity: 1,
        unit: null,
        unitText: "",
        food: null,
        foodText: "good splash of whatever wine is open",
        originalText: "a good splash of whatever wine is open",
      });
    });
  });

  describe("the unit backtrack", () => {
    test("an unknown unit after an amount is proposed, not created", () => {
      expect(parse("2 sprigs rosemary")).toMatchObject({
        quantity: 2,
        unit: null,
        unitText: "sprigs",
        food: ROSEMARY,
        foodText: "",
      });
    });

    test("it only stands when dropping the word finds a food", () => {
      expect(parse("2 sprigs lovage")).toMatchObject({ unit: null, unitText: "", food: null, foodText: "sprigs lovage" });
    });

    test("an amount-less line never backtracks", () => {
      expect(parse("sprigs rosemary")).toMatchObject({ unit: null, unitText: "", food: null, foodText: "sprigs rosemary" });
    });
  });

  describe("an amount-less line does not spend its last word on a unit", () => {
    test("pinch alone stays text", () => {
      expect(parse("pinch")).toMatchObject({ quantity: null, unit: null, unitText: "", food: null, foodText: "pinch" });
    });

    test("but a pinch of something still takes the unit", () => {
      expect(parse("a pinch salt")).toMatchObject({ quantity: 1, unit: PINCH, food: SALT });
    });
  });

  test("originalText is the line as given, trimmed and otherwise untouched", () => {
    expect(parse("  =1½ cups plain flour, sifted  ").originalText).toBe("=1½ cups plain flour, sifted");
  });

  test("bananas plural matches the food", () => {
    expect(parse("3 bananas, sliced")).toMatchObject({ quantity: 3, food: BANANA, note: "sliced" });
  });
});

// --- Round trip over the seed corpus ----------------------------------------
// `formatIngredient` is this function's inverse, so every ingredient the
// project ships — the three sample recipes and the fifteen generated dev ones —
// must survive a trip out through the formatter and back. Only the rows that
// have a food take part: a food-less row formats to its `originalText`
// verbatim, which carries no structure to recover.
//
// Three losses are inherent to formatting, not parser bugs, and are asserted
// accordingly rather than being papered over:
//   - `fixed` is not rendered at all (no `=` on screen), so it cannot come
//     back. Not asserted.
//   - a row with a unit but no quantity drops its unit on the way out (Mealie
//     hides the unit of an amount-less line), so the unit is only asserted
//     where the row has an amount.
//   - a quantity on a `fraction` unit snaps to the nearest vulgar glyph, whose
//     table's smallest step is 1/10, so it can come back up to 0.05 off. Those
//     are compared to one decimal place; everything else must be exact.

type CorpusIngredient = {
  recipe: string;
  quantity: number | null;
  unit: Unit | null;
  food: Food;
  note: string;
  originalText: string;
};

/** Every ingredient row with a food, from both seed corpora, as plain data. */
function corpusIngredients(): CorpusIngredient[] {
  const documents = [...SAMPLE_RECIPES, ...generateDevRecipes().map((made) => made.input)];
  const rows: CorpusIngredient[] = [];
  for (const recipe of documents) {
    for (const part of recipe.parts) {
      for (const ingredient of part.ingredients ?? []) {
        if (!ingredient.food) continue;
        rows.push({
          recipe: recipe.name,
          quantity: ingredient.quantity ?? null,
          unit: (ingredient.unit as Unit | null) ?? null,
          food: ingredient.food as Food,
          note: ingredient.note ?? "",
          originalText: ingredient.originalText ?? "",
        });
      }
    }
  }
  return rows;
}

const CORPUS = corpusIngredients();

/** The vocabulary the corpus uses, deduplicated by name the way the reference tables are. */
function corpusVocabulary(rows: readonly CorpusIngredient[]): Vocabulary<Unit, Food> {
  const units = new Map<string, Unit>();
  const foods = new Map<string, Food>();
  for (const row of rows) {
    if (row.unit) units.set(row.unit.name.toLowerCase(), row.unit);
    foods.set(row.food.name.toLowerCase(), row.food);
  }
  return { units: [...units.values()], foods: [...foods.values()] };
}

const CORPUS_VOCABULARY = corpusVocabulary(CORPUS);

describe("round trip over the seed corpus", () => {
  test("the corpus is worth testing", () => {
    expect(CORPUS.length).toBeGreaterThan(100);
    expect(CORPUS_VOCABULARY.foods.length).toBeGreaterThan(20);
    expect(CORPUS_VOCABULARY.units.length).toBeGreaterThan(5);
  });

  test("every ingredient recovers its quantity, unit and food", () => {
    const failures: string[] = [];

    for (const row of CORPUS) {
      const display: DisplayIngredient = {
        quantity: row.quantity,
        unit: row.unit,
        food: row.food,
        note: row.note,
        originalText: row.originalText,
      };
      const line = formatIngredient(display);
      const parsed = parseIngredient(line, CORPUS_VOCABULARY);
      const where = `${row.recipe}: "${line}"`;

      // Quantity: exact, unless a fraction unit snapped it to a glyph.
      if (row.quantity === null || row.quantity === 0) {
        if (parsed.quantity !== null) failures.push(`${where} — expected no quantity, got ${parsed.quantity}`);
      } else if (row.unit?.fraction) {
        const recovered = parsed.quantity ?? Number.NaN;
        if (!(Math.abs(recovered - row.quantity) < 0.05)) {
          failures.push(`${where} — quantity ${recovered} is not within a glyph of ${row.quantity}`);
        }
      } else if (parsed.quantity !== row.quantity) {
        failures.push(`${where} — quantity ${parsed.quantity} !== ${row.quantity}`);
      }

      // Unit: only rendered when the row has an amount.
      const hasAmount = row.quantity !== null && row.quantity !== 0;
      if (hasAmount && row.unit) {
        if (parsed.unit?.name.toLowerCase() !== row.unit.name.toLowerCase()) {
          failures.push(`${where} — unit ${parsed.unit?.name ?? "none"} !== ${row.unit.name}`);
        }
      } else if (parsed.unit !== null) {
        failures.push(`${where} — expected no unit, got ${parsed.unit.name}`);
      }

      // Food: identity by name, and nothing of it left unresolved.
      if (parsed.food?.name.toLowerCase() !== row.food.name.toLowerCase()) {
        failures.push(`${where} — food ${parsed.food?.name ?? "none"} !== ${row.food.name}`);
      }
      if (parsed.foodText !== "") failures.push(`${where} — unresolved food text "${parsed.foodText}"`);
      if (parsed.unitText !== "" && parsed.unit === null) {
        failures.push(`${where} — proposed a unit "${parsed.unitText}" the row does not have`);
      }
    }

    expect(failures).toEqual([]);
  });
});
