// The Units tab's merge confirm: which units can be a target, and the dialog
// content UnitMergeDialogContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { mergeTargets, UnitMergeDialogContent } from "../../src/components/UnitMergeDialog";
import type { Unit } from "../../src/db/units";

function unit(id: string, name: string): Unit {
  return { id, name, pluralName: null, abbreviation: "", useAbbreviation: false, fraction: true, standardQuantity: null, standardUnitId: null };
}

const gram = unit("u1", "gram");
const kilogram = unit("u2", "kilogram");
const cup = unit("u3", "cup");

describe("mergeTargets", () => {
  test("every unit but the source, in the given order", () => {
    expect(mergeTargets([gram, kilogram, cup], kilogram.id)).toEqual([gram, cup]);
  });

  test("empty when the source is the only unit", () => {
    expect(mergeTargets([gram], gram.id)).toEqual([]);
  });

  test("an id that matches nothing changes nothing", () => {
    expect(mergeTargets([gram, cup], "missing")).toEqual([gram, cup]);
  });
});

describe("UnitMergeDialogContent render", () => {
  test("asks which unit survives and lists the other units as targets", () => {
    const html = renderToString(<UnitMergeDialogContent source={kilogram} targets={[gram, cup]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("Merge kilogram?");
    expect(html).toContain("kilogram will be deleted");
    expect(html).toContain(">Merge<");
    expect(html).toContain(">Cancel<");
  });

  test("no other unit to merge into says so instead of offering a picker", () => {
    const html = renderToString(<UnitMergeDialogContent source={gram} targets={[]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("There is no other unit to merge into.");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test("busy disables the buttons and reads Merging…", () => {
    const html = renderToString(<UnitMergeDialogContent source={kilogram} targets={[gram]} busy onCancel={() => {}} onConfirm={() => {}} />);
    expect(html).toContain("Merging…");
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
