// An import's lines in the household's terms (decisions.md row 227), on lines from the library's own sources.
import { describe, expect, test } from "vitest";
import { houseLines, metricText, splitCombined } from "../../../../src/domain/recipes/import/houseLines";

describe("metricText", () => {
  test("an imperial amount with no metric twin is converted, rounded as a cook would", () => {
    expect(metricText("3 pounds beef chuck (cut into large chunks)")).toBe("1.4 kg beef chuck (cut into large chunks)");
    expect(metricText("1½ lb boneless, skinless chicken thighs")).toBe("680 g boneless, skinless chicken thighs");
    expect(metricText("1 pound daikon")).toBe("450 g daikon");
    expect(metricText("4 (6-ounce) boneless skinless chicken breasts")).toBe("4 (170 g) boneless skinless chicken breasts");
    expect(metricText("1/2 oz dried mushrooms")).toBe("15 g dried mushrooms");
    expect(metricText("8 fl oz milk")).toBe("240 ml milk");
  });

  test("sizes and oven temperatures in a method are converted too, and a range converts both ends", () => {
    expect(metricText("cut into ¼-inch thick slices, with each slice quartered")).toBe("cut into 6 mm thick slices, with each slice quartered");
    expect(metricText("Arrange the cookies 3 inches apart.")).toBe("Arrange the cookies 7.5 cm apart.");
    expect(metricText("cut into 2-inch pieces")).toBe("cut into 5 cm pieces");
    expect(metricText("Preheat the oven to 325°F.")).toBe("Preheat the oven to 163°C.");
    expect(metricText("Bake at 425 degrees F")).toBe("Bake at 218°C");
    expect(metricText("1.2 - 1.5 lb chicken breasts")).toBe("540–680 g chicken breasts");
  });

  test("an amount beside its metric twin is left for the house style, which keeps the metric one", () => {
    for (const line of [
      "450 g flank steak (sliced into ¼-inch/6mm thick pieces)",
      "100g / 3.5 oz pork mince",
      "2 carrots (6.7 oz, 190 g)",
      "Preheat the oven to 163°C (325°F).",
      "600-750g / 1.2 - 1.5 lb chicken breasts",
    ])
      expect(metricText(line)).toBe(line);
  });

  test("what is already metric, or not a measure at all, is untouched, and a second run changes nothing", () => {
    for (const line of ["2 cups water", "1 tbsp fish sauce", "Simmer for 90 minutes.", "2 and 1/4 cups (281g) all-purpose flour", "salt, to taste"])
      expect(metricText(line)).toBe(line);
    const once = metricText("3 pounds beef chuck, cut into 2-inch pieces");
    expect(metricText(once)).toBe(once);
  });
});

describe("splitCombined", () => {
  test("two ingredients joined by + are two lines, the note after the second said of both", () => {
    expect(splitCombined("1 large egg + 1 egg yolk, at room temperature")).toEqual(["1 large egg, at room temperature", "1 egg yolk, at room temperature"]);
    expect(splitCombined("2 tsp cornflour plus 2 tbsp water")).toEqual(["2 tsp cornflour", "2 tbsp water"]);
  });

  test("one amount, or a + with no amount after it, stays one line", () => {
    for (const line of ["2 and 1/4 cups (281g) all-purpose flour", "salt + pepper", "1 tsp ginger + garlic paste", "1 egg"])
      expect(splitCombined(line)).toEqual([line]);
  });
});

test("houseLines splits and converts every line, and converts every step", () => {
  const recipe = houseLines({
    name: "Cookies",
    description: "",
    image: null,
    servings: null,
    yieldText: "",
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    facets: {},
    parts: [{ name: "", ingredients: ["1 large egg + 1 egg yolk", "4 oz chocolate"], steps: ["Heat the oven to 325°F.", "Space them 3 inches apart."] }],
  } as never);
  expect(recipe.parts[0]).toEqual({
    name: "",
    ingredients: ["1 large egg", "1 egg yolk", "110 g chocolate"],
    steps: ["Heat the oven to 163°C.", "Space them 7.5 cm apart."],
  });
});
