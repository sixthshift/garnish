import { describe, expect, test } from "vitest";
import { facetsFromWords, mergeFacets, wordKey } from "../../../../src/domain/recipes/import/scraped/facets";
import { type FacetLayer, type Facets, noFacets } from "../../../../src/domain/recipes/recipe";

/** One value on one layer, and nothing else. */
const only = (layer: FacetLayer, value: string): Facets => ({ ...noFacets(), [layer]: [value] });

describe("facetsFromWords (M49.5)", () => {
  // Every row of the table, as a source would spell it.
  test.each([
    ["Main", "course", "main"],
    ["Mains", "course", "main"],
    ["Main Course", "course", "main"],
    ["main courses", "course", "main"],
    ["Main Dish", "course", "main"],
    ["main dishes", "course", "main"],
    ["Entree", "course", "main"],
    ["Entrée", "course", "main"],
    ["Entrees", "course", "main"],
    ["Soup", "course", "soup"],
    ["Soups", "course", "soup"],
    ["Salad", "course", "salad"],
    ["Salads", "course", "salad"],
    ["Side", "course", "side"],
    ["Sides", "course", "side"],
    ["Side Dish", "course", "side"],
    ["side dishes", "course", "side"],
    ["Starter", "course", "starter"],
    ["Starters", "course", "starter"],
    ["Appetiser", "course", "starter"],
    ["Appetisers", "course", "starter"],
    ["Appetizer", "course", "starter"],
    ["Appetizers", "course", "starter"],
    ["Dessert", "course", "dessert"],
    ["Desserts", "course", "dessert"],
    ["Sweets", "course", "dessert"],
    ["Baking", "course", "baking"],
    ["Snack", "course", "snack"],
    ["Snacks", "course", "snack"],
    ["Drink", "course", "drink"],
    ["Drinks", "course", "drink"],
    ["Beverage", "course", "drink"],
    ["Beverages", "course", "drink"],
    ["Sauce", "course", "sauce"],
    ["Sauces", "course", "sauce"],
    ["Dressing", "course", "sauce"],
    ["Dressings", "course", "sauce"],
    ["Condiment", "course", "condiment"],
    ["Condiments", "course", "condiment"],
    ["Preserve", "course", "condiment"],
    ["Preserves", "course", "condiment"],
    ["Spice Mix", "course", "spice-mix"],
    ["Spice blend", "course", "spice-mix"],
    ["Marinade", "course", "spice-mix"],
    ["Marinades", "course", "spice-mix"],
    ["Stock", "course", "stock"],
    ["Breakfast", "meal", "breakfast"],
    ["Brunch", "meal", "breakfast"],
    ["Lunch", "meal", "lunch"],
    ["Dinner", "meal", "dinner"],
    ["Supper", "meal", "dinner"],
    ["Australian", "cuisine", "australian"],
    ["Australia", "cuisine", "australian"],
    ["British", "cuisine", "british"],
    ["French", "cuisine", "french"],
    ["France", "cuisine", "french"],
    ["Italian", "cuisine", "italian"],
    ["Italy", "cuisine", "italian"],
    ["Spanish", "cuisine", "spanish"],
    ["Spain", "cuisine", "spanish"],
    ["Greek", "cuisine", "greek"],
    ["Greece", "cuisine", "greek"],
    ["Eastern European", "cuisine", "eastern-european"],
    ["Polish", "cuisine", "eastern-european"],
    ["Russian", "cuisine", "eastern-european"],
    ["Ukrainian", "cuisine", "eastern-european"],
    ["Hungarian", "cuisine", "eastern-european"],
    ["Middle Eastern", "cuisine", "middle-eastern"],
    ["Lebanese", "cuisine", "middle-eastern"],
    ["Turkish", "cuisine", "middle-eastern"],
    ["Persian", "cuisine", "middle-eastern"],
    ["North African", "cuisine", "north-african"],
    ["Moroccan", "cuisine", "north-african"],
    ["American", "cuisine", "american"],
    ["Latin American", "cuisine", "latin-american"],
    ["Mexican", "cuisine", "latin-american"],
    ["Mexico", "cuisine", "latin-american"],
    ["Brazilian", "cuisine", "latin-american"],
    ["Peruvian", "cuisine", "latin-american"],
    ["Indian", "cuisine", "indian"],
    ["India", "cuisine", "indian"],
    ["Sri Lankan", "cuisine", "sri-lankan"],
    ["Sri Lanka", "cuisine", "sri-lankan"],
    ["Chinese", "cuisine", "chinese"],
    ["China", "cuisine", "chinese"],
    ["Japanese", "cuisine", "japanese"],
    ["Japan", "cuisine", "japanese"],
    ["Korean", "cuisine", "korean"],
    ["Korea", "cuisine", "korean"],
    ["Thai", "cuisine", "thai"],
    ["Thailand", "cuisine", "thai"],
    ["Vietnamese", "cuisine", "vietnamese"],
    ["Vietnam", "cuisine", "vietnamese"],
    ["Southeast Asian", "cuisine", "southeast-asian"],
    ["South-East Asian", "cuisine", "southeast-asian"],
    ["Malaysian", "cuisine", "southeast-asian"],
    ["Indonesian", "cuisine", "southeast-asian"],
    ["Filipino", "cuisine", "southeast-asian"],
    ["Vegetarian", "diet", "vegetarian"],
    ["https://schema.org/VegetarianDiet", "diet", "vegetarian"],
    ["Vegan", "diet", "vegan"],
    ["http://schema.org/VeganDiet", "diet", "vegan"],
    ["Pescatarian", "diet", "pescatarian"],
    ["Pescetarian", "diet", "pescatarian"],
    ["Gluten Free", "diet", "gluten-free"],
    ["gluten-free", "diet", "gluten-free"],
    ["GlutenFreeDiet", "diet", "gluten-free"],
    ["Dairy-Free", "diet", "dairy-free"],
    ["Nut free", "diet", "nut-free"],
    ["Chicken", "mainIngredient", "chicken"],
    ["Beef", "mainIngredient", "beef"],
    ["Lamb", "mainIngredient", "lamb"],
    ["Pork", "mainIngredient", "pork"],
    ["Fish", "mainIngredient", "fish"],
    ["Seafood", "mainIngredient", "seafood"],
    ["Tofu", "mainIngredient", "tofu"],
    ["Pasta", "mainIngredient", "pasta"],
    ["Noodles", "mainIngredient", "pasta"],
    ["Stovetop", "method", "stovetop"],
    ["Stove top", "method", "stovetop"],
    ["BBQ", "method", "bbq"],
    ["Barbecue", "method", "bbq"],
    ["Barbeque", "method", "bbq"],
    ["Slow Cooker", "method", "slow-cooker"],
    ["Crockpot", "method", "slow-cooker"],
    ["Crock-Pot", "method", "slow-cooker"],
    ["Pressure Cooker", "method", "pressure-cooker"],
    ["Instant Pot", "method", "pressure-cooker"],
    ["Air Fryer", "method", "air-fryer"],
    ["Airfryer", "method", "air-fryer"],
    ["No-Cook", "method", "no-cook"],
    ["Summer", "season", "summer"],
    ["Autumn", "season", "autumn"],
    ["Fall", "season", "autumn"],
    ["Winter", "season", "winter"],
    ["Spring", "season", "spring"],
  ] as const)("%s is %s %s", (word, layer, value) => {
    expect(facetsFromWords([word])).toEqual(only(layer, value));
  });

  test("case, accents and punctuation do not matter", () => {
    for (const word of ["MAIN COURSE", "main-course", "  Main   Course! ", "main_course", "ENTRÉE"]) {
      expect(facetsFromWords([word])).toEqual(only("course", "main"));
    }
  });

  test.each([
    "Asian", // too broad: Chinese, Thai, Indian and Japanese are all Asian
    "Lactose free",
    "https://schema.org/LowLactoseDiet",
    "https://schema.org/HalalDiet",
    "Easy",
    "Quick dinner", // matched whole, never word by word
    "Chicken thighs",
    "Baked",
    "Eggs",
    "Rice",
    "Oven",
    "Asian-inspired",
    "",
  ])("%j says nothing", (word) => {
    expect(facetsFromWords([word])).toEqual(noFacets());
  });

  test("many words, each layer a set in its list's order, once each", () => {
    expect(facetsFromWords(["Dinner", "Thai", "Mains, Salad", "Main Course", "Vegetarian", "Easy", "Vietnamese"])).toEqual({
      ...noFacets(),
      course: ["main", "salad"],
      meal: ["dinner"],
      cuisine: ["thai", "vietnamese"],
      diet: ["vegetarian"],
    });
  });

  test("Dinner is a meal, not a course", () => {
    expect(facetsFromWords(["Dinner"]).course).toEqual([]);
  });
});

describe("wordKey and mergeFacets", () => {
  test("a word's key", () => {
    expect(wordKey("Entrée")).toBe("entree");
    expect(wordKey("https://schema.org/GlutenFreeDiet")).toBe("glutenfreediet");
    expect(wordKey(" Gluten-Free ")).toBe("gluten free");
  });

  test("merging keeps every value once, in the list's order", () => {
    expect(mergeFacets({ ...noFacets(), course: ["side"] }, { ...noFacets(), course: ["main", "side"], diet: ["vegan"] })).toEqual({
      ...noFacets(),
      course: ["main", "side"],
      diet: ["vegan"],
    });
  });
});

test("grill says nothing of the method: the barbecue to an American page, the oven's grill to an Australian one", () => {
  expect(facetsFromWords(["Grill", "grilling"]).method).toEqual([]);
});
