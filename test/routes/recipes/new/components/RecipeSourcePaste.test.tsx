// The fourth source: pasted text read by `claude -p` (M34.5). Static render
// only (no jsdom in this project's vitest config), so the markup is checked
// with `renderToString` and the decisions by calling the stage components
// directly. The importer's own tests are in test/domain/import.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { draftFromScraped, importSummary, PasteSource, SourceChooser } from "../../../../../src/routes/recipes/new/components/RecipeSource";
import type { Food as FoodRow } from "../../../../../src/db/models/food/repo";
import { reviewRows, rowCommit } from "../../../../../src/domain/ingredient/bulkIngredients";
import type { Unit } from "../../../../../src/domain/recipe/recipe";
import { review, type ScrapedRecipe } from "../../../../../src/domain/import";

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

describe("the chooser gates the AI rung on the binary", () => {
  test("a missing `claude` hides the option entirely", () => {
    const html = renderToString(<SourceChooser onChoose={() => {}} />);
    expect(html).not.toContain('data-source="paste"');
    expect(html).not.toContain("Pasted text");
    // The rungs that need nothing installed are still there.
    expect(html).toContain('data-source="url"');
    expect(html).toContain('data-source="file"');
    expect(html).toContain('data-source="manual"');
  });

  test("with the binary installed it sits beside the others and reports itself", () => {
    const html = renderToString(<SourceChooser aiAvailable onChoose={() => {}} />);
    expect(html).toContain('data-source="paste"');
    expect(html).toContain("Pasted text");

    const chosen: string[] = [];
    const element = SourceChooser({ aiAvailable: true, onChoose: (kind) => chosen.push(kind) });
    const button = elementWithProp(element, "data-source", "paste");
    expect(button).not.toBeNull();
    (button!.props.onClick as () => void)();
    expect(chosen).toEqual(["paste"]);
  });

  test("busy locks the paste option with the rest", () => {
    const element = SourceChooser({ aiAvailable: true, disabled: true, onChoose: () => {} });
    expect(elementWithProp(element, "data-source", "paste")?.props.disabled).toBe(true);
  });
});

describe("PasteSource", () => {
  test("renders the box and will not read a blank one", () => {
    const html = renderToString(<PasteSource text="" onTextChange={() => {}} onRead={() => {}} onBack={() => {}} />);
    expect(html).toContain('data-source-stage="paste"');
    expect(html).toContain("From pasted text");
    expect(html).toContain("Read the text");
    expect(html).toContain("disabled");
  });

  test("typed text enables the read, and busy locks both controls", () => {
    const read = PasteSource({ text: "1 cup flour", onTextChange: () => {}, onRead: () => {}, onBack: () => {} });
    expect(renderToString(read)).toContain("Read the text");
    const busy = renderToString(<PasteSource text="1 cup flour" busy onTextChange={() => {}} onRead={() => {}} onBack={() => {}} />);
    expect(busy).toContain("Reading…");
  });

  test("a malformed answer is reported where it happened, and no draft is built", () => {
    const message = "Claude's answer was not in the expected shape. Nothing was imported.";
    const html = renderToString(<PasteSource text="prose" error={message} onTextChange={() => {}} onRead={() => {}} onBack={() => {}} />);
    expect(html).toContain('data-testid="import-error"');
    expect(html).toContain("could not be read");
    expect(html).toContain("Nothing was imported");
  });
});

describe("an AI answer through the review", () => {
  // A model's answer as the importer hands it on: every field filled, the main body first.
  const recipe: ScrapedRecipe = {
    name: "Anzac biscuits",
    description: "",
    image: null,
    servings: 24,
    yieldText: "biscuits",
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    parts: [
      { name: "", ingredients: ["125 g flour"], steps: ["Mix."] },
      { name: "Syrup", ingredients: [], steps: ["Melt."] },
    ],
  };

  test("the review says Claude read it and asks for it to be checked", () => {
    const summary = importSummary("ai", 1, 2);
    expect(summary).toContain("Claude read 1 ingredient and 2 steps");
    expect(summary).toContain("Check them");
    expect(summary).toContain("nothing is saved yet");
  });

  test("it becomes a draft the same way a scraped page does, with no source URL", () => {
    const rows = reviewRows(review.ingredientLines(recipe), { units: [gram], foods: [flour] });
    const draft = draftFromScraped({
      scraped: recipe,
      sourceUrl: "",
      commits: rows.map(rowCommit),
      createdFoods: new Map(),
      createdUnits: new Map(),
    });
    expect(draft.name).toBe("Anzac biscuits");
    expect(draft.sourceUrl).toBeNull();
    expect(draft.recipeServings).toBe(24);
    expect(draft.parts.map((part) => part.name)).toEqual(["", "Syrup"]);
    // The ingredients land on the main body, and the known food is matched.
    expect(draft.parts[0]!.ingredients).toHaveLength(1);
    expect(draft.parts[0]!.ingredients[0]!.food?.id).toBe(flour.id);
    expect(draft.parts[1]!.steps.map((step) => step.text)).toEqual(["Melt."]);
  });
});
