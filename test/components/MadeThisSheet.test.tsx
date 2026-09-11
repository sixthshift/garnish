// The "Made this" sheet: its pure date helpers, and the form
// MadeThisSheetContent renders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MadeThisSheetContent, isValidDate, todayIso } from "../../src/components/MadeThisSheet";

describe("todayIso", () => {
  test("writes the local calendar date as YYYY-MM-DD", () => {
    expect(todayIso(new Date(2026, 8, 11, 13, 45))).toBe("2026-09-11");
  });

  test("pads month and day", () => {
    expect(todayIso(new Date(2026, 0, 4, 0, 5))).toBe("2026-01-04");
  });

  test("defaults to now, and is a date the form accepts", () => {
    expect(isValidDate(todayIso())).toBe(true);
  });
});

describe("isValidDate", () => {
  test.each([
    ["2026-09-11", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["11/09/2026", false],
    ["2026-9-1", false],
    ["", false],
  ])("%s -> %s", (value, expected) => {
    expect(isValidDate(value)).toBe(expected);
  });
});

describe("MadeThisSheetContent render", () => {
  const render = (busy = false) =>
    renderToString(<MadeThisSheetContent today="2026-09-11" busy={busy} onSave={() => {}} onCancel={() => {}} />);

  test("offers a date defaulting to today, a comment and a photo picker", () => {
    const html = render();
    expect(html).toContain("Made this");
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-09-11"');
    expect(html).toContain("Comment");
    expect(html).toContain("Photo");
    expect(html).toContain("Choose image");
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("while saving the buttons are disabled", () => {
    expect(render(true)).toContain("Saving…");
    expect(render(true)).toContain("disabled");
  });
});
