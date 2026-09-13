// The Foods tab's merge confirm: which foods can be a target, and the dialog
// content FoodMergeDialogContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FoodMergeDialogContent, mergeTargets } from "../../src/components/FoodMergeDialog";
import type { Food } from "../../src/db/models/food/repo";

function food(id: string, name: string): Food {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [] };
}

const butter = food("f1", "Butter");
const unsalted = food("f2", "Unsalted butter");
const salt = food("f3", "Salt");

describe("mergeTargets", () => {
  test("every food but the source, in the given order", () => {
    expect(mergeTargets([butter, unsalted, salt], unsalted.id)).toEqual([butter, salt]);
  });

  test("empty when the source is the only food", () => {
    expect(mergeTargets([butter], butter.id)).toEqual([]);
  });

  test("an id that matches nothing changes nothing", () => {
    expect(mergeTargets([butter, salt], "missing")).toEqual([butter, salt]);
  });
});

describe("FoodMergeDialogContent render", () => {
  test("asks which food survives and lists the other foods as targets", () => {
    const html = renderToString(
      <FoodMergeDialogContent source={unsalted} targets={[butter, salt]} onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(html).toContain("Merge Unsalted butter?");
    expect(html).toContain("Unsalted butter will be deleted");
    expect(html).toContain(">Merge<");
    expect(html).toContain(">Cancel<");
  });

  test("no other food to merge into says so instead of offering a picker", () => {
    const html = renderToString(<FoodMergeDialogContent source={butter} targets={[]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("There is no other food to merge into.");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test("busy disables the buttons and reads Merging…", () => {
    const html = renderToString(<FoodMergeDialogContent source={unsalted} targets={[butter]} busy onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("Merging…");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
