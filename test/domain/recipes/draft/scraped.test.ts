// An imported part's steps are linked to the rows they name: the part's own
// first, then the rest of the recipe's (decisions.md row 228).
import { describe, expect, test } from "vitest";
import { foodReference } from "../../../../src/domain/recipes/draft";
import { withSuggestedLinks } from "../../../../src/domain/recipes/draft/scraped";

const row = (id: string, name: string) => ({ id, originalText: name, food: foodReference({ name }) });

describe("withSuggestedLinks", () => {
  test("a step links its own part's rows and the other parts' rows it names", () => {
    const part = {
      id: "marinade",
      name: "Marinade",
      ingredients: [row("beef", "beef")],
      steps: [{ id: "s1", text: "Slice the beef, tomatoes and ginger." }],
    };
    const linked = withSuggestedLinks(part, [
      { id: "tomato", food: foodReference({ name: "tomatoes" }) },
      { id: "ginger", food: foodReference({ name: "ginger" }) },
    ]);
    expect(linked.steps[0]!.ingredientIds).toEqual(["beef", "tomato", "ginger"]);
  });

  test("with nothing elsewhere it links its own part only, as before", () => {
    const part = { id: "p", name: "", ingredients: [row("salt", "salt")], steps: [{ id: "s1", text: "Season with salt and pepper." }] };
    expect(withSuggestedLinks(part).steps[0]!.ingredientIds).toEqual(["salt"]);
  });
});
