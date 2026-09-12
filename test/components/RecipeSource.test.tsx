// The source chooser and the URL import (M23.6). Static render only (no jsdom
// in this project's vitest config), so the markup is checked with
// `renderToString` and the decisions by calling the stage components directly.
//
// The Checks the task asks for are here: the chooser and each stage render, a
// stub says so and still reaches the editor, and `sourceUrl` is filled.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  draftFromScraped,
  ImportReview,
  importSummary,
  SourceChooser,
  stepCount,
  UrlSource,
  yieldLabel,
} from "../../src/components/RecipeSource";
import { isTextOnly } from "../../src/components/IngredientsEditor";
import type { Food as FoodRow } from "../../src/db/models/food/repo";
import { reviewRows, rowCommit } from "../../src/domain/bulkIngredients";
import type { Unit } from "../../src/domain/recipe";
import type { ScrapedRecipe } from "../../src/domain/schemaRecipe";
import type { ImportedRecipe } from "../../src/server/recipeImport";

const gram: Unit = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};
const units = [gram];
const flour: FoodRow = { id: "11111111-1111-4111-8111-111111111111", name: "flour", pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false };
const foods = [flour];

const SOURCE = "https://example.test/anzac-biscuits";

const scraped: ScrapedRecipe = {
  name: "Anzac biscuits",
  description: "Chewy and golden.",
  image: "https://example.test/a.jpg",
  servings: 24,
  yieldText: "biscuits",
  prepMinutes: 20,
  cookMinutes: 15,
  tags: ["baking"],
  ingredients: ["200 g flour", "100 g almond meal"],
  parts: [{ name: "", steps: ["Heat the oven."] }, { name: "Icing", steps: ["Whisk.", "Pour."] }],
};

const stub: ScrapedRecipe = {
  ...scraped,
  description: "",
  servings: 0,
  yieldText: "",
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  ingredients: [],
  parts: [{ name: "", steps: [] }],
};

const imported = (recipe: ScrapedRecipe, from: ImportedRecipe["from"] = "schema"): ImportedRecipe => ({ from, url: SOURCE, recipe });

function rows() {
  return reviewRows(scraped.ingredients, { units, foods });
}

const reviewProps = {
  units,
  searchFoods: (async () => []) as (q: string) => Promise<FoodRow[]>,
  onRowsChange: () => {},
  onBack: () => {},
  onCreate: () => {},
};

/** The first element in `node` carrying `prop` set to `value`. */
function elementWithProp(node: ReactNode, prop: string, value: string): ReactElement<Record<string, any>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementWithProp(child as ReactNode, prop, value);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<Record<string, any>>;
  if (element.props[prop] === value) return element;
  return elementWithProp(element.props.children as ReactNode, prop, value);
}

/** The first element in `node` whose `children` prop is exactly `text`. */
function elementWithChildren(node: ReactNode, text: string): ReactElement<Record<string, any>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementWithChildren(child as ReactNode, text);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<Record<string, any>>;
  if (element.props.children === text) return element;
  return elementWithChildren(element.props.children as ReactNode, text);
}

describe("yieldLabel, stepCount and importSummary", () => {
  test("yieldLabel reads what the page said", () => {
    expect(yieldLabel(scraped)).toBe("24 biscuits");
    expect(yieldLabel({ ...scraped, yieldText: "" })).toBe("Serves 24");
    expect(yieldLabel({ ...scraped, servings: 0, yieldText: "a big tray" })).toBe("a big tray");
    expect(yieldLabel({ ...scraped, servings: 0, yieldText: "" })).toBe("");
  });

  test("stepCount counts across every part", () => {
    expect(stepCount(scraped)).toBe(3);
    expect(stepCount(stub)).toBe(0);
  });

  test("importSummary says what was read, or admits there was nothing", () => {
    expect(importSummary("schema", 2, 3)).toContain("Read 2 ingredients and 3 steps");
    expect(importSummary("schema", 1, 1)).toContain("1 ingredient and 1 step");
    expect(importSummary("stub", 0, 0)).toContain("no recipe data");
  });
});

describe("SourceChooser", () => {
  test("offers the two sources", () => {
    const html = renderToString(<SourceChooser onChoose={() => {}} />);
    expect(html).toContain('data-source-stage="choose"');
    expect(html).toContain("Where is this recipe from?");
    expect(html).toContain('data-source="url"');
    expect(html).toContain('data-source="manual"');
    expect(html).toContain("A web page");
    expect(html).toContain("My own");
  });

  test("choosing reports which one", () => {
    const chosen: string[] = [];
    const node = SourceChooser({ onChoose: (kind) => chosen.push(kind) });
    elementWithProp(node, "data-source", "url")?.props.onClick();
    expect(chosen).toEqual(["url"]);
    elementWithProp(node, "data-source", "manual")?.props.onClick();
    expect(chosen).toEqual(["url", "manual"]);
  });

  test("disabled locks both", () => {
    const node = SourceChooser({ onChoose: () => {}, disabled: true });
    expect(elementWithProp(node, "data-source", "url")?.props.disabled).toBe(true);
    expect(elementWithProp(node, "data-source", "manual")?.props.disabled).toBe(true);
  });
});

describe("UrlSource", () => {
  test("takes one address, and will not fetch a blank one", () => {
    const html = renderToString(<UrlSource url="" onUrlChange={() => {}} onFetch={() => {}} onBack={() => {}} />);
    expect(html).toContain('data-source-stage="url"');
    expect(html).toContain('aria-label="Recipe address"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Read the page</);
    expect(html).toContain(">Back<");
  });

  test("a typed address enables the fetch", () => {
    const html = renderToString(<UrlSource url={SOURCE} onUrlChange={() => {}} onFetch={() => {}} onBack={() => {}} />);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Read the page</);
  });

  test("an error is shown where it happened", () => {
    const html = renderToString(<UrlSource url={SOURCE} error="Could not reach example.test" onUrlChange={() => {}} onFetch={() => {}} onBack={() => {}} />);
    expect(html).toContain('data-testid="import-error"');
    expect(html).toContain("Could not reach example.test");
  });

  test("busy says so and locks both controls", () => {
    const html = renderToString(<UrlSource url={SOURCE} busy onUrlChange={() => {}} onFetch={() => {}} onBack={() => {}} />);
    expect(html).toContain("Reading…");
    expect(html.match(/<button[^>]*disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ImportReview", () => {
  test("shows what the page gave up", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={imported(scraped)} rows={rows()} />);
    expect(html).toContain('data-source-stage="review"');
    expect(html).toContain('data-import-from="schema"');
    expect(html).toContain("Anzac biscuits");
    expect(html).toContain("Read 2 ingredients and 3 steps");
    expect(html).toContain("24 biscuits");
    expect(html).toContain("Prep 20 min");
    expect(html).toContain("Cook 15 min");
    expect(html).toContain("baking");
    expect(html).toContain(SOURCE);
    // One review row per ingredient line, in the shape bulk add reviews.
    expect(html.match(/data-review-row=""/g)).toHaveLength(2);
    expect(html).toContain('data-status="matched"');
    expect(html).toContain("Unknown food “almond meal”");
    // The page's sections survive as named parts (decision 59).
    expect(html).toContain("Icing");
    expect(html).toContain("Heat the oven.");
    expect(html).toContain("Whisk.");
  });

  test("a stub says plainly that there was nothing to read", () => {
    const html = renderToString(<ImportReview {...reviewProps} imported={imported(stub, "stub")} rows={[]} />);
    expect(html).toContain('data-import-from="stub"');
    expect(html).toContain('data-testid="stub-notice"');
    expect(html).toContain("no recipe data");
    expect(html).not.toContain("data-review-row");
    // It still offers to create: a named, illustrated, linked shell is worth having.
    expect(html).toContain(">Create<");
  });

  test("a duplicate source is a warning, not a refusal", () => {
    const html = renderToString(
      <ImportReview {...reviewProps} imported={imported(scraped)} rows={rows()} duplicate={{ name: "Anzac biscuits", slug: "anzac-biscuits" }} />,
    );
    expect(html).toContain('data-testid="duplicate-notice"');
    expect(html).toContain("You already have this one");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Create</);
  });

  test("Create and Back report themselves", () => {
    let creates = 0;
    let backs = 0;
    const node = ImportReview({ ...reviewProps, imported: imported(scraped), rows: rows(), onCreate: () => (creates += 1), onBack: () => (backs += 1) });
    elementWithChildren(node, "Create")?.props.onClick();
    elementWithChildren(node, "Back")?.props.onClick();
    expect(creates).toBe(1);
    expect(backs).toBe(1);
  });
});

describe("draftFromScraped", () => {
  const build = (recipe: ScrapedRecipe = scraped) =>
    draftFromScraped({
      scraped: recipe,
      sourceUrl: SOURCE,
      commits: reviewRows(recipe.ingredients, { units, foods }).map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
    });

  test("the fields come across, and sourceUrl is filled", () => {
    const draft = build();
    expect(draft.name).toBe("Anzac biscuits");
    expect(draft.description).toBe("Chewy and golden.");
    expect(draft.recipeServings).toBe(24);
    expect(draft.recipeYield).toBe("biscuits");
    expect(draft.recipeYieldQuantity).toBe(24);
    expect(draft.prepTime).toBe(20);
    expect(draft.performTime).toBe(15);
    expect(draft.sourceUrl).toBe(SOURCE);
    expect(draft.tags.map((tag) => tag.name)).toEqual(["baking"]);
  });

  test("a bare servings count is not repeated as a yield", () => {
    expect(build({ ...scraped, yieldText: "" }).recipeYieldQuantity).toBe(0);
  });

  test("the page's sections become parts, ingredients on the unnamed body", () => {
    const draft = build();
    expect(draft.parts.map((part) => part.name)).toEqual(["", "Icing"]);
    expect(draft.parts[0]!.steps.map((step) => step.text)).toEqual(["Heat the oven."]);
    expect(draft.parts[1]!.steps.map((step) => step.text)).toEqual(["Whisk.", "Pour."]);
    expect(draft.parts[0]!.ingredients).toHaveLength(2);
    expect(draft.parts[1]!.ingredients).toEqual([]);
  });

  test("an all-sections page gains an unnamed body to hold the ingredients", () => {
    const sectionsOnly = { ...scraped, parts: [{ name: "Pastry", steps: ["Rub in."] }] };
    const draft = build(sectionsOnly);
    expect(draft.parts.map((part) => part.name)).toEqual(["", "Pastry"]);
    expect(draft.parts[0]!.ingredients).toHaveLength(2);
    expect(draft.parts[0]!.steps).toEqual([]);
  });

  test("a matched line is structured and an unapproved one stays text", () => {
    const [matched, declined] = build().parts[0]!.ingredients;
    expect(matched!.food?.name).toBe("flour");
    expect(matched!.quantity).toBe(200);
    expect(matched!.unit?.name).toBe("gram");
    expect(isTextOnly(declined!)).toBe(true);
    expect(declined!.originalText).toBe("100 g almond meal");
  });

  test("a stub still becomes a valid draft: a name, a source, and one empty part", () => {
    const draft = build(stub);
    expect(draft.name).toBe("Anzac biscuits");
    expect(draft.sourceUrl).toBe(SOURCE);
    expect(draft.parts).toHaveLength(1);
    expect(draft.parts[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(draft.rating).toBeNull();
    expect(draft.recipeServings).toBe(0);
  });

  test("an existing tag is reused rather than duplicated", () => {
    const baking = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Baking", slug: "baking" };
    const draft = draftFromScraped({
      scraped,
      sourceUrl: SOURCE,
      commits: [],
      createdFoods: new Map(),
      createdUnits: new Map(),
      knownTags: [baking],
    });
    expect(draft.tags).toEqual([baking]);
  });
});
