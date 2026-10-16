// A page in, a result out (M23.5): the schema.org rung, the OpenGraph stub,
// the SEO shell that falls through, and nothing. Pure, so no fetcher here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { extractRecipe, scrapedFromStub } from "../../../src/domain/import/extract";
import { ingredientLines } from "../../../src/domain/import/scraped/parts";

const URL_UNDER_TEST = "https://example.test/anzac-biscuits";

/** A recorded schema.org page (M35.4). */
const RECIPE_200 = readFileSync(join(import.meta.dirname, "../../fixtures/importUrl/recipe-200.html"), "utf8");

/** A page carrying a schema.org Recipe. */
const SCHEMA_PAGE = `<html><head>
<meta property="og:title" content="Ignored, the schema wins">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"Site"},
  {"@type":"Recipe","name":"Anzac biscuits","recipeYield":"24 biscuits","prepTime":"PT20M",
   "recipeIngredient":["1 cup plain flour","125 g butter"],
   "recipeInstructions":[{"@type":"HowToStep","text":"Mix."},{"@type":"HowToStep","text":"Bake."}]}
]}</script></head><body></body></html>`;

/** A page with only OpenGraph tags. */
const STUB_PAGE = `<html><head>
<meta property="og:title" content="Nan's shortbread">
<meta property="og:description" content="A family recipe.">
<meta property="og:image" content="https://example.test/sb.jpg">
</head><body><p>Cream the butter and sugar…</p></body></html>`;

/** A page carrying a Recipe node with nothing in it, as some sites emit for SEO. */
const EMPTY_SCHEMA_PAGE = `<html><head>
<script type="application/ld+json">{"@type":"Recipe","name":"Shell"}</script>
<meta property="og:title" content="Shell from OpenGraph">
</head><body></body></html>`;

/** A recorded-style page whose recipe is microdata only, with OpenGraph tags beside it. */
const MICRODATA_PAGE = readFileSync(join(import.meta.dirname, "../../fixtures/importUrl/microdata-page.html"), "utf8");

const BARE_PAGE = "<html><head><title>Nothing here</title></head><body><p>Prose.</p></body></html>";

describe("scrapedFromStub", () => {
  test("keeps what it knows and leaves the lists empty", () => {
    const scraped = scrapedFromStub({ name: "Toast", description: "Hot bread.", image: "https://x.test/a.jpg" });
    expect(scraped).toMatchObject({ name: "Toast", description: "Hot bread.", image: "https://x.test/a.jpg", servings: 0 });
    // One empty part, so the draft it builds still validates.
    expect(scraped.parts).toEqual([{ name: "", ingredients: [], steps: [] }]);
  });
});

describe("extractRecipe", () => {
  test("schema.org wins where the page has it", () => {
    const found = extractRecipe(SCHEMA_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("schema");
    expect(found?.url).toBe(URL_UNDER_TEST);
    expect(found?.recipe.name).toBe("Anzac biscuits");
    expect(ingredientLines(found!.recipe)).toEqual(["1 cup plain flour", "125 g butter"]);
    expect(found?.recipe.parts[0]!.steps).toEqual(["Mix.", "Bake."]);
    expect(found?.recipe.servings).toBe(24);
    expect(found?.recipe.prepMinutes).toBe(20);
  });

  test("microdata is read where the page has no JSON-LD, and wins over OpenGraph", () => {
    const found = extractRecipe(MICRODATA_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("schema");
    expect(found?.recipe).toMatchObject({
      name: "Lemon delicious pudding",
      description: "A sponge that sits on its own lemon sauce — Nan's favourite.",
      image: "https://example.test/lemon.jpg?w=800&h=600",
      servings: 6,
      prepMinutes: 15,
      cookMinutes: 45,
      tags: ["Dessert", "Winter", "Lemon"],
    });
    expect(ingredientLines(found!.recipe)).toEqual(["60 g butter, softened", "1 cup caster sugar", "3 eggs, separated", "1 ½ cups milk"]);
    expect(found?.recipe.parts[0]!.steps).toEqual([
      "Preheat oven to 180°C.",
      "Cream the butter and sugar, then beat in the yolks.",
      "Fold in the whites and bake for 45 minutes.",
    ]);
  });

  test("a usable JSON-LD recipe is taken before microdata", () => {
    const both = SCHEMA_PAGE.replace("<body></body>", `<body>${MICRODATA_PAGE.slice(MICRODATA_PAGE.indexOf("<article"))}</body>`);
    expect(extractRecipe(both, URL_UNDER_TEST)?.recipe.name).toBe("Anzac biscuits");
  });

  test("OpenGraph is the fallback", () => {
    const found = extractRecipe(STUB_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("stub");
    expect(found?.recipe.name).toBe("Nan's shortbread");
    expect(found?.recipe.description).toBe("A family recipe.");
    expect(found?.recipe.image).toBe("https://example.test/sb.jpg");
    expect(ingredientLines(found!.recipe)).toEqual([]);
  });

  test("an empty Recipe node falls through to the stub rather than importing a shell", () => {
    const found = extractRecipe(EMPTY_SCHEMA_PAGE, URL_UNDER_TEST);
    expect(found?.from).toBe("stub");
    expect(found?.recipe.name).toBe("Shell from OpenGraph");
  });

  test("neither is null", () => {
    expect(extractRecipe(BARE_PAGE, URL_UNDER_TEST)).toBeNull();
    expect(extractRecipe("", URL_UNDER_TEST)).toBeNull();
  });
});

// M36.7: the extract takes a pasted page as readily as a fetched one, so
// view-source-and-paste gets exactly what the fetch would have.
describe("a pasted page", () => {
  test("a page's HTML gives the same result whether it was fetched or pasted", () => {
    const found = extractRecipe(RECIPE_200, URL_UNDER_TEST);
    expect(found).toEqual(extractRecipe(RECIPE_200, URL_UNDER_TEST));
    expect(found?.from).toBe("schema");
    expect(found?.pageText).not.toBe("");
  });

  test("markup with neither structured data nor OpenGraph tags is null, and the caller decides", () => {
    expect(extractRecipe(BARE_PAGE, URL_UNDER_TEST)).toBeNull();
  });
});
