// What an import read beside Check (decisions.md row 207): each line is linked
// only to the rows the import itself made from it, word for word.
import { expect, test } from "vitest";
import { emptyDraft, indexSource, linkSource, NAME_ROW, previewRecipe, type RecipeDraft, wordsOf } from "../../../../src/domain/recipes/draft";

function draft(): RecipeDraft {
  const base = emptyDraft();
  return {
    ...base,
    name: "Fried Rice",
    parts: [
      {
        id: "p1",
        name: "",
        ingredients: [
          { id: "i1", originalText: "2 cups cooked rice, day old", note: "day old" },
          { id: "i2", originalText: "1 1/2 tbsp soy sauce", note: "" },
          { id: "i3", originalText: "salt", note: "" },
        ],
        steps: [{ id: "s1", text: "Fry the rice.", title: "", summary: "", ingredientIds: [] }],
      },
    ],
  };
}

const PAGE = [
  "# Fried Rice",
  "Posted on Tuesday",
  "▢ 2 cups cooked rice , day old",
  "▢ 1 ½ tbsp soy sauce",
  "salt",
  "salt",
  "Fry the rice.",
  "Comments (12)",
].join("\n");

test("a line's words are the same whatever the punctuation, case, spacing or fraction glyph", () => {
  expect(wordsOf("▢ 2 cups Cooked rice , day old")).toBe(wordsOf("2 cups cooked rice, day old"));
  expect(wordsOf("1 ½ tbsp")).toBe(wordsOf("1 1/2 tbsp"));
  expect(wordsOf("crème fraîche")).toBe(wordsOf("creme fraiche"));
});

test("each row lights the line it was read from, a repeated line goes to the next row, and the rest is left out", () => {
  const lines = linkSource(indexSource(PAGE), draft(), draft());
  expect(lines.map((line) => line.rows)).toEqual([[NAME_ROW], [], ["i1"], ["i2"], ["i3"], [], ["s1"], []]);
  expect(lines[0]).toMatchObject({ text: "Fried Rice", heading: true });
});

test("a step keeps its line while it is edited, by its text as the import read it", () => {
  const read = draft();
  const live = { ...read, parts: [{ ...read.parts[0]!, steps: [{ ...read.parts[0]!.steps[0]!, text: "Fry the rice until it crackles." }] }] };
  expect(linkSource(indexSource(PAGE), read, live)[6]!.rows).toEqual(["s1"]);
});

test("a line that differs by a word is not matched: nothing is guessed", () => {
  const lines = linkSource(indexSource("2 cups cooked rice day old (Note 2)"), draft(), draft());
  expect(lines[0]!.rows).toEqual([]);
});

test("the preview is the draft as a saved recipe, with defaults filled and ids given by place", () => {
  const recipe = previewRecipe({ ...draft(), name: "", parts: [{ name: "", ingredients: [{ originalText: "salt" }], steps: [{ text: "Stir." }] }] });
  expect(recipe.name).toBe("");
  expect(recipe.parts[0]!.id).toBe("part-0");
  expect(recipe.parts[0]!.ingredients[0]).toMatchObject({ id: "ingredient-0-0", quantity: null, food: null, note: "", fixed: false, alternatives: [] });
  expect(recipe.parts[0]!.steps[0]).toMatchObject({ id: "step-0-0", title: "", text: "Stir.", ingredientIds: [], image: null });
});
