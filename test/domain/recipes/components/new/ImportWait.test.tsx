// The wait while an import runs: the steps it names by what it was made from,
// what it has found, and the Skip it offers while the model sorts.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ImportWait } from "../../../../../src/domain/recipes/components/new/ImportWait";
import { type ImportProgress, previewOf } from "../../../../../src/domain/recipes/components/new/useRecipeSource";
import type { ImportedRecipe } from "../../../../../src/domain/recipes/import";

const progress = (over: Partial<ImportProgress>): ImportProgress => ({ from: "page", phase: "get", found: null, startedAt: Date.now(), ...over });
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("previewOf", () => {
  const recipe = (url: string): ImportedRecipe =>
    ({
      from: "schema",
      url,
      pageText: "",
      recipe: {
        name: "Anzac biscuits",
        image: "https://example.com/a.jpg",
        parts: [
          { name: "", ingredients: ["1 cup oats", "125 g butter"], steps: ["Mix.", "Bake."] },
          { name: "Icing", ingredients: ["1 cup icing sugar"], steps: ["Ice."] },
        ],
      },
    }) as unknown as ImportedRecipe;

  test("counts every part's lines and names the site without its www", () => {
    expect(previewOf(recipe("https://www.recipetineats.com/anzac/"))).toEqual({
      name: "Anzac biscuits",
      image: "https://example.com/a.jpg",
      host: "recipetineats.com",
      ingredients: 3,
      steps: 3,
      ingredientLines: ["1 cup oats", "125 g butter", "1 cup icing sugar"],
      stepLines: ["Mix.", "Bake.", "Ice."],
    });
  });

  test("a paste has no site", () => {
    expect(previewOf(recipe("")).host).toBeNull();
  });
});

describe("ImportWait", () => {
  test("a page names the sort only when a model is there to do it", () => {
    expect(text(renderToString(<ImportWait progress={progress({})} aiAvailable />))).toContain("Getting the page Sorting it into parts Matching your foods");
    expect(text(renderToString(<ImportWait progress={progress({})} aiAvailable={false} />))).toContain("Getting the page Matching your foods");
  });

  test("a paste and a file name their own first step", () => {
    expect(renderToString(<ImportWait progress={progress({ from: "text" })} aiAvailable />)).toContain("Reading your text…");
    expect(renderToString(<ImportWait progress={progress({ from: "file" })} aiAvailable={false} />)).toContain("Reading the file…");
  });

  test("while the model sorts, the steps before it are done, the pot boils, and what was found shows with Skip", () => {
    const found = {
      name: "Anzac biscuits",
      image: null,
      host: "recipetineats.com",
      ingredients: 8,
      steps: 1,
      ingredientLines: [
        "1 cup plain flour",
        "1 cup rolled oats",
        "1 cup coconut",
        "3/4 cup brown sugar",
        "125 g butter",
        "2 tbsp golden syrup",
        "1/2 tsp bicarb",
        "2 tbsp water",
      ],
      stepLines: ["Mix and bake."],
    };
    const html = renderToString(<ImportWait progress={progress({ phase: "sort", found })} aiAvailable onSkip={() => {}} />);
    expect(html).toContain("Sorting it into parts…");
    expect(html).toMatch(/data-state="done"[^>]*>.*Getting the page/);
    expect(html).toContain('data-boil="hard"');
    expect(text(html)).toContain("recipetineats.com · 8 ingredients · 1 step");
    expect(html).toContain("Skip sorting into parts");
  });

  test("getting the page simmers over a card of shimmering bars, with nothing found and no Skip yet", () => {
    const html = renderToString(<ImportWait progress={progress({})} aiAvailable />);
    expect(html).toContain('data-boil="low"');
    expect(html).toContain('data-testid="import-sketch"');
    expect(html).toContain("sketch-bar");
    expect(html).not.toContain('data-testid="import-found"');
    expect(html).not.toContain("Skip sorting into parts");
  });

  test("the found card lands its first six ingredients in turn and says how many more", () => {
    const found = {
      name: "Anzac biscuits",
      image: "https://example.com/a.jpg",
      host: null,
      ingredients: 8,
      steps: 1,
      ingredientLines: ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => `line ${x}`),
      stepLines: ["Mix and bake."],
    };
    const sorting = renderToString(<ImportWait progress={progress({ phase: "sort", found })} aiAvailable />);
    expect(sorting).toContain("line f");
    expect(sorting).not.toContain("line g");
    expect(text(sorting)).toContain("and 2 more");
    expect(sorting).toContain("Mix and bake.");
    expect(sorting).toContain("sketch-photo");
    expect(sorting).toMatch(/--i:\s*7/);
  });
});
