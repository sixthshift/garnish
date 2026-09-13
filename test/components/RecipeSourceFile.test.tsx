// The third source: an uploaded Mealie (M34.3) or Tandoor (M34.4) export.
// Static render only (no jsdom in this project's vitest config), so the markup
// is checked with `renderToString` and the draft by calling `draftFromScraped`
// directly.
//
// The task's Check that a `title` becomes a part is in
// test/domain/importMealie.test.ts; this file follows that part through the
// review and into the draft, where its rows must land on the part they came
// from rather than all on the main body.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Food as FoodRow } from "../../src/db/models/food/repo";
import { rowCommit } from "../../src/domain/bulkIngredients";
import { mealieRecipe, reviewRowsFromMealie, type MealieRecipe } from "../../src/domain/importMealie";
import { reviewRowsFromTandoor, tandoorRecipesFrom, type TandoorRecipe } from "../../src/domain/importTandoor";
import type { Unit } from "../../src/domain/recipe";
import {
  draftFromScraped,
  duplicateMessage,
  FileSource,
  ImportReview,
  RecipePicker,
  SourceChooser,
} from "../../src/components/RecipeSource";
import type { ImportedRecipe } from "../../src/server/recipeImport";

const FIXTURE = join(import.meta.dirname, "../fixtures/mealie/lemon-tart.json");
const recipe = (): MealieRecipe => mealieRecipe(JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>);

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
const flour: FoodRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "flour",
  pluralName: null,
  aliases: [],
  aisleId: null,
  recipeId: null,
  skipShopping: false,
  conversions: [],
};
const units = [gram];
const foods = [flour];

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

describe("the chooser", () => {
  test("offers the export beside the web page and your own", () => {
    const html = renderToString(<SourceChooser onChoose={() => {}} />);
    expect(html).toContain('data-source="file"');
    expect(html).toContain("A Mealie or Tandoor export");
  });

  test("choosing the export reports it up, the way the route's ?source expects", () => {
    const chosen: string[] = [];
    const element = SourceChooser({ onChoose: (kind) => chosen.push(kind) });
    const button = elementWithProp(element, "data-source", "file");
    expect(button).not.toBeNull();
    (button!.props.onClick as () => void)();
    expect(chosen).toEqual(["file"]);
  });
});

describe("FileSource", () => {
  test("renders the picker, the file's name and the read button", () => {
    const html = renderToString(
      <FileSource file={new File(["{}"], "backup.zip")} onFileChange={() => {}} onRead={() => {}} onBack={() => {}} />,
    );
    expect(html).toContain('data-source-stage="file"');
    expect(html).toContain("From a Mealie or Tandoor export");
    expect(html).toContain("backup.zip");
    expect(html).toContain("Read the file");
  });

  test("with no file chosen it says so, and an error is shown", () => {
    const html = renderToString(
      <FileSource file={null} error="That file is not JSON or a zip" onFileChange={() => {}} onRead={() => {}} onBack={() => {}} />,
    );
    expect(html).toContain("No file chosen");
    expect(html).toContain('data-testid="import-error"');
    expect(html).toContain("That file is not JSON or a zip");
  });
});

describe("RecipePicker", () => {
  test("a backup with several recipes asks which one", () => {
    const picked: number[] = [];
    const recipes = [recipe(), { ...recipe(), name: "Pancakes" }];
    const element = RecipePicker({ recipes, onPick: (index) => picked.push(index), onBack: () => {} });
    const html = renderToString(element);
    expect(html).toContain('data-source-stage="pick"');
    expect(html).toContain("That file holds 2 recipes");
    expect(html).toContain('data-import-choice="0"');
    expect(html).toContain("Lemon tart");
    expect(html).toContain("Pancakes");
    expect(html).toContain("4 ingredients, 4 steps");

    // Picking one names it by position, which is what the shell reads back.
    const second = elementWithProp(element, "data-import-choice", "1");
    (second!.props.onClick as () => void)();
    expect(picked).toEqual([1]);
  });
});

describe("the review", () => {
  const reviewed = () => reviewRowsFromMealie(recipe(), { units, foods });
  const imported = (): ImportedRecipe => ({ from: "mealie", url: recipe().sourceUrl, recipe: recipe() });

  test("the uploaded recipe lands on the same review, with its parts and steps", () => {
    const html = renderToString(
      <ImportReview
        imported={imported()}
        rows={reviewed().rows}
        units={units}
        searchFoods={async () => []}
        onRowsChange={() => {}}
        onBack={() => {}}
        onCreate={() => {}}
      />,
    );
    expect(html).toContain('data-import-from="mealie"');
    expect(html).toContain("Read 4 ingredients and 4 steps");
    expect(html).toContain('data-import-part="Pastry"');
    expect(html).toContain('data-import-part="Filling"');
    // The M17.5 rows, one per ingredient, matched where the vocabulary has it.
    expect(html.match(/data-review-row=""/g)).toHaveLength(4);
    expect(html).toContain("200 g plain flour, sifted");
  });

  test("a recipe already here under that name is a warning, not a refusal", () => {
    const html = renderToString(
      <ImportReview
        imported={imported()}
        rows={reviewed().rows}
        units={units}
        searchFoods={async () => []}
        duplicate={{ name: "Lemon tart", slug: "lemon-tart" }}
        duplicateBy="name"
        onRowsChange={() => {}}
        onBack={() => {}}
        onCreate={() => {}}
      />,
    );
    expect(html).toContain('data-testid="duplicate-notice"');
    expect(html).toContain("already here under that name");
  });

  test("duplicateMessage says which way it matched", () => {
    expect(duplicateMessage("Lemon tart", "name")).toContain("already here under that name");
    expect(duplicateMessage("Lemon tart", "url")).toContain("imported from the same address");
  });
});

describe("the draft", () => {
  test("each row lands on the part it came from, with the steps and the links", () => {
    const source = recipe();
    const { rows, rowParts } = reviewRowsFromMealie(source, { units, foods });
    const draft = draftFromScraped({
      scraped: source,
      sourceUrl: source.sourceUrl,
      commits: rows.map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
      rowParts,
      notes: source.notes,
      rating: source.rating,
    });

    expect(draft.parts.map((part) => part.name)).toEqual(["Pastry", "Filling", "To finish"]);
    expect(draft.parts[0]!.ingredients.map((row) => row.originalText)).toEqual(["200 g plain flour, sifted", "100 g cold butter, cubed"]);
    expect(draft.parts[1]!.ingredients).toHaveLength(2);
    expect(draft.parts[2]!.ingredients).toHaveLength(0);
    expect(draft.parts[0]!.steps.map((step) => step.text)).toEqual(["Rub the butter into the flour.", "Chill for 30 minutes, then blind bake."]);

    // What Mealie carried beside the rows.
    expect(draft.name).toBe("Lemon tart");
    expect(draft.sourceUrl).toBe("https://example.test/lemon-tart");
    expect(draft.rating).toBe(5);
    expect(draft.notes).toEqual([{ title: "Tip", text: "Use a hot knife to slice it." }]);
    expect(draft.tags.map((tag) => tag.name)).toEqual(["Baking", "Dessert"]);
    expect(draft.recipeServings).toBe(8);
    expect(draft.prepTime).toBe(30);
    expect(draft.performTime).toBe(60);

    // suggestLinks (M28.2) ran over each part: the flour step links the flour row.
    const flourRow = draft.parts[0]!.ingredients[0]!;
    expect(draft.parts[0]!.steps[0]!.ingredientIds).toContain(flourRow.id);
  });

  test("without rowParts the rows still go on the main body, as a scraped page's do", () => {
    const source = recipe();
    const { rows } = reviewRowsFromMealie(source, { units, foods });
    const draft = draftFromScraped({
      scraped: source,
      sourceUrl: "",
      commits: rows.map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
    });
    expect(draft.sourceUrl).toBeNull();
    expect(draft.parts[0]!.name).toBe("");
    expect(draft.parts[0]!.ingredients).toHaveLength(4);
  });
});

describe("a Tandoor export (M34.4)", () => {
  const TANDOOR = join(import.meta.dirname, "../fixtures/tandoor");
  const read = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(TANDOOR, name), "utf8")) as Record<string, unknown>;
  const tandoor = (): TandoorRecipe => tandoorRecipesFrom([read("lemon-tart.json"), read("lemon-curd.json")])[0]!;

  test("it lands on the same review, saying which export it came from", () => {
    const source = tandoor();
    const { rows } = reviewRowsFromTandoor(source, { units, foods });
    const html = renderToString(
      <ImportReview
        imported={{ from: "tandoor", url: source.sourceUrl, recipe: source }}
        rows={rows}
        units={units}
        searchFoods={async () => []}
        duplicateBy="name"
        onRowsChange={() => {}}
        onBack={() => {}}
        onCreate={() => {}}
      />,
    );
    expect(html).toContain('data-import-from="tandoor"');
    expect(html).toContain("Read 6 ingredients and 4 steps");
    expect(html).toContain('data-import-part="Pastry"');
    expect(html).toContain('data-import-part="Filling"');
    expect(html).toContain("200 g plain flour, sifted");
  });

  test("the draft keeps each step's own rows linked to it, not guessed", () => {
    const source = tandoor();
    const { rows, rowParts, rowSteps } = reviewRowsFromTandoor(source, { units, foods });
    const draft = draftFromScraped({
      scraped: source,
      sourceUrl: source.sourceUrl,
      commits: rows.map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
      rowParts,
      rowSteps,
    });

    expect(draft.parts.map((part) => part.name)).toEqual(["Pastry", "Filling", ""]);
    expect(draft.name).toBe("Lemon tart");
    expect(draft.recipeServings).toBe(8);
    expect(draft.prepTime).toBe(30);
    expect(draft.performTime).toBe(60);
    expect(draft.sourceUrl).toBe("https://example.test/lemon-tart");
    expect(draft.tags.map((tag) => tag.name)).toEqual(["Baking", "Dessert"]);

    // The flour row was written under the pastry step, so that step links it.
    const pastry = draft.parts[0]!;
    expect(pastry.steps).toHaveLength(1);
    expect(pastry.steps[0]!.ingredientIds).toEqual(pastry.ingredients.map((row) => row.id));

    // The body's two steps take one row each — the nested recipes — rather
    // than both taking both.
    const body = draft.parts[2]!;
    expect(body.steps).toHaveLength(2);
    expect(body.steps[0]!.ingredientIds).toEqual([body.ingredients[0]!.id]);
    expect(body.steps[1]!.ingredientIds).toEqual([body.ingredients[1]!.id]);
  });

  test("the nested child in the export is the row the food link is offered for", () => {
    const { rows, subRecipeNames } = reviewRowsFromTandoor(tandoor(), { units, foods });
    expect(subRecipeNames).toEqual(["Lemon curd"]);
    // Still a proposal: nothing is created until the reviewer says so.
    expect(rows[4]!.food).toEqual({ kind: "none" });
    expect(rows[4]!.foodText).toBe("Lemon curd");
  });
});
