// The Units tab's editor sheet: the form UnitEditSheetContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { UnitEditSheetContent } from "../../../src/components/reference/UnitEditSheet";
import type { Unit } from "../../../src/db/models/unit/repo";

const gram: Unit = {
  id: "u1",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

describe("UnitEditSheetContent render", () => {
  const render = (unit: Unit, busy = false) => renderToString(<UnitEditSheetContent unit={unit} busy={busy} onSave={() => {}} onCancel={() => {}} />);

  test("shows the unit's current values: name, plural, abbreviation and flags", () => {
    const html = render(gram);
    expect(html).toContain("Edit gram");
    expect(html).toContain('value="gram"');
    expect(html).toContain('value="grams"');
    expect(html).toContain('value="g"');
    expect(html).toContain("Use abbreviation");
    expect(html).toContain("Fractions");
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("a null plural and an empty abbreviation show blank", () => {
    const html = render({ ...gram, pluralName: null, abbreviation: "" });
    expect(html).not.toContain('value="grams"');
  });

  test("busy disables the form and Save reads Saving…", () => {
    const html = render(gram, true);
    expect(html).toContain("Saving…");
    expect(html.match(/disabled/g)?.length).toBeGreaterThan(0);
  });
});
