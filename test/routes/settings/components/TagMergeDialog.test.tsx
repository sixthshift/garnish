// The Tags tab's merge confirm: which tags can be a target, and the dialog
// content TagMergeDialogContent renders. Mirrors FoodMergeDialog/UnitMergeDialog.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { mergeTargets, TagMergeDialogContent } from "../../../../src/routes/settings/components/TagMergeDialog";
import type { Tag } from "../../../../src/domain/recipe/recipe";

function tag(id: string, name: string): Tag {
  return { id, name, slug: name.toLowerCase() };
}

const weeknight = tag("t1", "Weeknight");
const quick = tag("t2", "Quick");
const baking = tag("t3", "Baking");

describe("mergeTargets", () => {
  test("every tag but the source, in the given order", () => {
    expect(mergeTargets([weeknight, quick, baking], quick.id)).toEqual([weeknight, baking]);
  });

  test("empty when the source is the only tag", () => {
    expect(mergeTargets([weeknight], weeknight.id)).toEqual([]);
  });

  test("an id that matches nothing changes nothing", () => {
    expect(mergeTargets([weeknight, baking], "missing")).toEqual([weeknight, baking]);
  });
});

describe("TagMergeDialogContent render", () => {
  test("asks which tag survives and lists the other tags as targets", () => {
    const html = renderToString(<TagMergeDialogContent source={quick} targets={[weeknight, baking]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("Merge Quick?");
    expect(html).toContain("Quick will be deleted");
    expect(html).toContain(">Merge<");
    expect(html).toContain(">Cancel<");
  });

  test("no other tag to merge into says so instead of offering a picker", () => {
    const html = renderToString(<TagMergeDialogContent source={weeknight} targets={[]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("There is no other tag to merge into.");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test("busy disables the buttons and reads Merging…", () => {
    const html = renderToString(<TagMergeDialogContent source={quick} targets={[weeknight]} busy onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("Merging…");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
