import { describe, expect, test } from "vitest";
import {
  decodeEntities,
  durationToMinutes,
  firstImage,
  hasContent,
  ingredientLines,
  normaliseScraped,
  parseKeywords,
  parseYield,
  partsFromInstructions,
  ScrapedRecipeSchema,
  scrapedFromSchema,
  text,
} from "../../src/domain/schemaRecipe";

describe("decodeEntities and text", () => {
  test("named and numeric entities decode", () => {
    expect(decodeEntities("Salt &amp; pepper")).toBe("Salt & pepper");
    expect(decodeEntities("Nan&#39;s recipe")).toBe("Nan's recipe");
    expect(decodeEntities("Nan&#x2019;s recipe")).toBe("Nan’s recipe");
    expect(decodeEntities("&frac12; cup")).toBe("½ cup");
  });

  test("an entity nobody knows is left as written", () => {
    expect(decodeEntities("&notareal; thing")).toBe("&notareal; thing");
  });

  test("tags are stripped and runs of whitespace collapsed within a line", () => {
    expect(text("<p>Sharp   and buttery.</p>")).toBe("Sharp and buttery.");
    expect(text("  spaced  out  ")).toBe("spaced out");
  });

  test("a newline the source wrote is kept, because that is what splits a step block", () => {
    expect(text("Mix.\n  Bake.  ")).toBe("Mix.\nBake.");
  });

  test("line breaks survive as newlines so a block can still be split", () => {
    expect(text("Mix.<br>Bake.")).toBe("Mix.\nBake.");
    expect(text("<p>Mix.</p><p>Bake.</p>")).toBe("Mix.\nBake.");
  });

  test("a number is text and anything else is empty", () => {
    expect(text(4)).toBe("4");
    expect(text(null)).toBe("");
    expect(text(undefined)).toBe("");
    expect(text({ a: 1 })).toBe("");
  });
});

describe("firstImage", () => {
  test.each([
    ["a string", "https://x.test/a.jpg"],
    ["a list", ["https://x.test/a.jpg", "https://x.test/b.jpg"]],
    ["an ImageObject", { "@type": "ImageObject", url: "https://x.test/a.jpg" }],
    ["a list of ImageObjects", [{ "@type": "ImageObject", url: "https://x.test/a.jpg" }]],
    ["contentUrl", { "@type": "ImageObject", contentUrl: "https://x.test/a.jpg" }],
  ])("%s", (_name, value) => {
    expect(firstImage(value)).toBe("https://x.test/a.jpg");
  });

  test("nothing usable is null", () => {
    expect(firstImage(undefined)).toBeNull();
    expect(firstImage([])).toBeNull();
    expect(firstImage("   ")).toBeNull();
    expect(firstImage({ "@type": "ImageObject" })).toBeNull();
  });
});

describe("durationToMinutes", () => {
  test.each([
    ["PT20M", 20],
    ["PT1H30M", 90],
    ["PT2H", 120],
    ["P1DT2H", 1560],
    ["PT90S", 2],
    ["pt1h", 60],
    [30, 30],
    ["30", 30],
  ])("%s -> %s", (value, expected) => {
    expect(durationToMinutes(value)).toBe(expected);
  });

  test.each([[undefined], [null], [""], ["about an hour"], ["PT0M"], ["P"], [0], [-5], [{}]])("%s is null", (value) => {
    expect(durationToMinutes(value)).toBeNull();
  });

  test("months and years are ignored rather than guessed at", () => {
    // P1M is one month before a T, not one minute; a recipe has neither.
    expect(durationToMinutes("P1M")).toBeNull();
    expect(durationToMinutes("PT1M")).toBe(1);
  });
});

describe("parseYield", () => {
  test.each([
    ["12 muffins", { servings: 12, yieldText: "muffins" }],
    ["4 servings", { servings: 4, yieldText: "" }],
    ["4 Servings", { servings: 4, yieldText: "" }],
    ["1 loaf", { servings: 1, yieldText: "loaf" }],
    ["4", { servings: 4, yieldText: "" }],
    [4, { servings: 4, yieldText: "" }],
    ["a big tray", { servings: 0, yieldText: "a big tray" }],
    [undefined, { servings: 0, yieldText: "" }],
  ])("%s", (value, expected) => {
    expect(parseYield(value)).toEqual(expected);
  });

  test.each([
    ["Makes 20", { servings: 20, yieldText: "" }],
    ["Serves 4", { servings: 4, yieldText: "" }],
    ["Makes 12 muffins", { servings: 12, yieldText: "muffins" }],
    ["Makes about 20 biscuits", { servings: 20, yieldText: "biscuits" }],
    ["Yields: 6", { servings: 6, yieldText: "" }],
    ["approximately 8 slices", { servings: 8, yieldText: "slices" }],
  ])("a leading verb is stripped: %s", (value, expected) => {
    // Found against BBC Good Food, which writes "Makes 20".
    expect(parseYield(value)).toEqual(expected);
  });

  test("a list prefers the entry that carries a number", () => {
    expect(parseYield(["a tray", "12 muffins"])).toEqual({ servings: 12, yieldText: "muffins" });
    expect(parseYield(["a tray", "Makes 20"])).toEqual({ servings: 20, yieldText: "" });
    expect(parseYield(["a tray", "a dish"])).toEqual({ servings: 0, yieldText: "a tray" });
  });
});

describe("parseKeywords", () => {
  test("a comma-separated string splits", () => {
    expect(parseKeywords("quick, vegetarian ,  weeknight")).toEqual(["quick", "vegetarian", "weeknight"]);
  });

  test("a list is taken as written, and nested commas still split", () => {
    expect(parseKeywords(["quick", "vegetarian, easy"])).toEqual(["quick", "vegetarian", "easy"]);
  });

  test("blanks and case-insensitive duplicates are dropped", () => {
    expect(parseKeywords(["Quick", "quick", "", "  "])).toEqual(["Quick"]);
    expect(parseKeywords(undefined)).toEqual([]);
  });

  test("an object with a name is read", () => {
    expect(parseKeywords([{ "@type": "Thing", name: "quick" }])).toEqual(["quick"]);
  });
});

describe("partsFromInstructions", () => {
  test("a single string splits on its newlines", () => {
    expect(partsFromInstructions("Mix.\nRest.\nBake.")).toEqual([{ name: "", ingredients: [], steps: ["Mix.", "Rest.", "Bake."] }]);
  });

  test("a single string with no newlines is one step", () => {
    expect(partsFromInstructions("Mix it all and bake.")).toEqual([{ name: "", ingredients: [], steps: ["Mix it all and bake."] }]);
  });

  test("HTML inside a string becomes the line breaks it was drawn with", () => {
    expect(partsFromInstructions("<p>Mix.</p><p>Bake.</p>")).toEqual([{ name: "", ingredients: [], steps: ["Mix.", "Bake."] }]);
  });

  test("a list of strings", () => {
    expect(partsFromInstructions(["Mix.", "Bake."])).toEqual([{ name: "", ingredients: [], steps: ["Mix.", "Bake."] }]);
  });

  test("a list of HowToStep, reading text or falling back to name", () => {
    const value = [
      { "@type": "HowToStep", text: "Mix." },
      { "@type": "HowToStep", name: "Bake." },
    ];
    expect(partsFromInstructions(value)).toEqual([{ name: "", ingredients: [], steps: ["Mix.", "Bake."] }]);
  });

  test("a list of HowToSection becomes one part each, named (decision 59)", () => {
    const value = [
      { "@type": "HowToSection", name: "Pastry", itemListElement: [{ "@type": "HowToStep", text: "Rub in." }] },
      { "@type": "HowToSection", name: "Filling", itemListElement: [{ "@type": "HowToStep", text: "Whisk." }, { "@type": "HowToStep", text: "Pour." }] },
    ];
    expect(partsFromInstructions(value)).toEqual([
      { name: "Pastry", ingredients: [], steps: ["Rub in."] },
      { name: "Filling", ingredients: [], steps: ["Whisk.", "Pour."] },
    ]);
  });

  test("steps loose beside sections land in the unnamed main body, which prints first", () => {
    const value = [
      { "@type": "HowToStep", text: "Heat the oven." },
      { "@type": "HowToSection", name: "Pastry", itemListElement: [{ "@type": "HowToStep", text: "Rub in." }] },
    ];
    expect(partsFromInstructions(value)).toEqual([
      { name: "", ingredients: [], steps: ["Heat the oven."] },
      { name: "Pastry", ingredients: [], steps: ["Rub in."] },
    ]);
  });

  test("an empty section is dropped rather than left as a blank heading", () => {
    const value = [
      { "@type": "HowToSection", name: "Nothing", itemListElement: [] },
      { "@type": "HowToSection", name: "Pastry", itemListElement: [{ "@type": "HowToStep", text: "Rub in." }] },
    ];
    expect(partsFromInstructions(value)).toEqual([{ name: "Pastry", ingredients: [], steps: ["Rub in."] }]);
  });

  test("a step nesting its own itemListElement is read through", () => {
    const value = [{ "@type": "HowToStep", name: "Ignored", itemListElement: [{ "@type": "HowToDirection", text: "Mix." }] }];
    expect(partsFromInstructions(value)).toEqual([{ name: "", ingredients: [], steps: ["Mix."] }]);
  });

  test("there is always at least one part, so the draft validates", () => {
    expect(partsFromInstructions(undefined)).toEqual([{ name: "", ingredients: [], steps: [] }]);
    expect(partsFromInstructions([])).toEqual([{ name: "", ingredients: [], steps: [] }]);
  });
});

describe("scrapedFromSchema", () => {
  const node = {
    "@type": "Recipe",
    name: "Anzac biscuits",
    description: "<p>Chewy and golden.</p>",
    image: ["https://x.test/a.jpg"],
    recipeYield: "24 biscuits",
    prepTime: "PT20M",
    cookTime: "PT15M",
    keywords: "biscuits, baking",
    recipeIngredient: ["1 cup plain flour", "125 g butter", "  "],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Heat the oven to 180C." },
      { "@type": "HowToStep", text: "Mix and bake." },
    ],
  };

  test("a full node maps across", () => {
    expect(scrapedFromSchema(node)).toEqual({
      name: "Anzac biscuits",
      description: "Chewy and golden.",
      image: "https://x.test/a.jpg",
      servings: 24,
      yieldText: "biscuits",
      prepMinutes: 20,
      cookMinutes: 15,
      tags: ["biscuits", "baking"],
      parts: [{ name: "", ingredients: ["1 cup plain flour", "125 g butter"], steps: ["Heat the oven to 180C.", "Mix and bake."] }],
    });
  });

  test("every recipeIngredient line goes on the unnamed part, whatever sections the page has (M36.2)", () => {
    const sectioned = scrapedFromSchema({
      "@type": "Recipe",
      name: "Lemon tart",
      recipeIngredient: ["200 g plain flour", "4 lemons"],
      recipeInstructions: [
        { "@type": "HowToSection", name: "Pastry", itemListElement: [{ "@type": "HowToStep", text: "Rub in." }] },
        { "@type": "HowToSection", name: "Filling", itemListElement: [{ "@type": "HowToStep", text: "Whisk." }] },
      ],
    });
    // schema.org cannot say which section a line sits under, so the page's own
    // sections keep their steps and an unnamed body is added to hold the lines.
    expect(sectioned.parts).toEqual([
      { name: "", ingredients: ["200 g plain flour", "4 lemons"], steps: [] },
      { name: "Pastry", ingredients: [], steps: ["Rub in."] },
      { name: "Filling", ingredients: [], steps: ["Whisk."] },
    ]);
  });

  test("a node with nothing but a name comes back empty rather than missing", () => {
    expect(scrapedFromSchema({ "@type": "Recipe", name: "Toast" })).toEqual({
      name: "Toast",
      description: "",
      image: null,
      servings: 0,
      yieldText: "",
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      parts: [{ name: "", ingredients: [], steps: [] }],
    });
  });

  test("an empty node does not throw", () => {
    expect(() => scrapedFromSchema({})).not.toThrow();
    expect(scrapedFromSchema({}).name).toBe("");
  });

  test("fields of the wrong type are treated as absent", () => {
    const odd = scrapedFromSchema({ "@type": "Recipe", name: "x", prepTime: {}, recipeIngredient: "not a list", keywords: 7 });
    expect(odd.prepMinutes).toBeNull();
    // A lone string is still one ingredient, which is the charitable reading.
    expect(ingredientLines(odd)).toEqual(["not a list"]);
    expect(odd.tags).toEqual(["7"]);
  });

  test("a page with only totalTime keeps it as the cook time rather than losing it", () => {
    // Found against BBC Good Food, which emits totalTime and neither of the others.
    const total = scrapedFromSchema({ "@type": "Recipe", name: "x", totalTime: "PT35M" });
    expect(total.cookMinutes).toBe(35);
    expect(total.prepMinutes).toBeNull();
    // A page that states a cook time is taken at its word, total or no total.
    const both = scrapedFromSchema({ "@type": "Recipe", name: "x", cookTime: "PT20M", totalTime: "PT35M" });
    expect(both.cookMinutes).toBe(20);
  });

  test("older pages using `ingredients` and `performTime` still read", () => {
    const legacy = scrapedFromSchema({ "@type": "Recipe", ingredients: ["2 eggs"], performTime: "PT5M" });
    expect(ingredientLines(legacy)).toEqual(["2 eggs"]);
    expect(legacy.cookMinutes).toBe(5);
  });
});

describe("hasContent", () => {
  test("is true with ingredients or steps, false with neither", () => {
    const blank = scrapedFromSchema({ "@type": "Recipe", name: "Toast" });
    expect(hasContent(blank)).toBe(false);
    expect(hasContent({ ...blank, parts: [{ name: "", ingredients: ["2 eggs"], steps: [] }] })).toBe(true);
    expect(hasContent({ ...blank, parts: [{ name: "", ingredients: [], steps: ["Mix."] }] })).toBe(true);
  });
});

describe("ScrapedRecipeSchema and normaliseScraped (M34.5)", () => {
  test("the schema is the type: a full recipe round-trips unchanged", () => {
    const full = {
      name: "Anzac biscuits",
      description: "A family recipe.",
      image: "https://example.test/a.jpg",
      servings: 24,
      yieldText: "biscuits",
      prepMinutes: 20,
      cookMinutes: 15,
      tags: ["biscuits"],
      parts: [{ name: "", ingredients: ["125 g butter"], steps: ["Mix."] }],
    };
    expect(normaliseScraped(ScrapedRecipeSchema.parse(full))).toEqual(full);
  });

  test("only the name is required; what is left out comes back empty", () => {
    expect(ScrapedRecipeSchema.parse({ name: "Toast" })).toEqual({
      name: "Toast",
      description: "",
      image: null,
      servings: 0,
      yieldText: "",
      prepMinutes: null,
      cookMinutes: null,
      tags: [],
      parts: [],
    });
    expect(ScrapedRecipeSchema.safeParse({ description: "no name" }).success).toBe(false);
    expect(ScrapedRecipeSchema.safeParse({ name: "Toast", parts: [{ name: "", ingredients: "bread" }] }).success).toBe(false);
  });

  test("normalising trims, drops blanks, and always leaves a main body", () => {
    const parsed = ScrapedRecipeSchema.parse({
      name: "  Anzac biscuits  ",
      tags: [" biscuits ", ""],
      parts: [
        { name: " Syrup ", ingredients: ["  125 g butter ", "   "], steps: [" Melt. ", ""] },
        { name: "", ingredients: [], steps: [] },
      ],
    });
    const recipe = normaliseScraped(parsed);
    expect(recipe.name).toBe("Anzac biscuits");
    expect(recipe.tags).toEqual(["biscuits"]);
    expect(recipe.parts).toEqual([
      { name: "", ingredients: [], steps: [] },
      { name: "Syrup", ingredients: ["125 g butter"], steps: ["Melt."] },
    ]);
    expect(ingredientLines(recipe)).toEqual(["125 g butter"]);
    expect(hasContent(recipe)).toBe(true);
  });

  test("a part with nothing at all on it is dropped, ingredients or no", () => {
    const recipe = normaliseScraped(ScrapedRecipeSchema.parse({ name: "Toast", parts: [{ name: "", ingredients: [], steps: [] }, { name: "", ingredients: [], steps: [] }] }));
    expect(recipe.parts).toEqual([{ name: "", ingredients: [], steps: [] }]);
  });
});
