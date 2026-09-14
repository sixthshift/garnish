// The "Made this" sheet: its pure date helpers, and the form
// MadeThisSheetContent renders. M25.3 added a rating star row here; M29.4
// removed it again (rating lives in the header only), so these tests check
// the sheet has no stars rather than that it does.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MadeThisSheetContent } from "../../../../../src/routes/recipes/recipe/components/MadeThisSheet";
import { isValidDate } from "../../../../../src/lib/dates";
import { todayIso } from "../../../../../src/domain/plan/plan";

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
  const render = (busy = false) => renderToString(<MadeThisSheetContent today="2026-09-11" busy={busy} onSave={() => {}} onCancel={() => {}} />);

  test("offers a date defaulting to today, a servings stepper, a comment and a photo picker", () => {
    const html = render();
    expect(html).toContain("Made this");
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-09-11"');
    expect(html).toContain("Servings");
    expect(html).toContain("Comment");
    expect(html).toContain("Photo");
    expect(html).toContain("Choose image");
    expect(html).toContain(">Save<");
    expect(html).toContain(">Cancel<");
  });

  test("the servings stepper defaults to 1 with no default given, or to the page's scale when given", () => {
    expect(render()).toContain('value="1"');
    const html = renderToString(<MadeThisSheetContent today="2026-09-11" defaultServings={6} onSave={() => {}} onCancel={() => {}} />);
    expect(html).toContain('value="6"');
  });

  test("carries no rating stars: rating lives in the header only", () => {
    const html = render();
    expect(html).not.toContain("Rating");
    for (const star of [1, 2, 3, 4, 5]) expect(html).not.toContain(`aria-label="Rate ${star} out of 5"`);
  });

  test("while saving the buttons are disabled", () => {
    expect(render(true)).toContain("Saving…");
    expect(render(true)).toContain("disabled");
  });
});
