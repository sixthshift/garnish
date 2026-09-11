// The recipe list's sort menu (M12.4): a fixed key+direction option list on
// the local Menu primitive. Static render only (no jsdom in this project's
// vitest config, see FilterBar.test.tsx), so these check markup, not click
// behaviour.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SortMenu } from "../../src/components/SortMenu";

function noop() {}

describe("SortMenu", () => {
  test("the trigger names the current sort", () => {
    const html = renderToString(<SortMenu sort="rating" dir="desc" onChange={noop} />);
    expect(html).toContain("Sort: Highest rated");
    expect(html).toContain('data-testid="menu-trigger"');
    expect(html).not.toContain('role="menu"'); // closed by default
  });

  test("created/desc (the default order) shows as 'Newest created'", () => {
    const html = renderToString(<SortMenu sort="created" dir="desc" onChange={noop} />);
    expect(html).toContain("Sort: Newest created");
  });

  test("open, every option renders once as a menuitem and the current one is checked", () => {
    const html = renderToString(<SortMenu sort="name" dir="asc" onChange={noop} open />);
    expect(html.match(/role="menuitem"/g)).toHaveLength(11);
    expect(html).toContain("Name (A–Z)");
    expect(html).toContain("Name (Z–A)");
    expect(html).toContain("Random");
    expect(html).toMatch(/✓<\/span>Name \(A–Z\)/);
    expect(html).not.toMatch(/✓<\/span>Name \(Z–A\)/);
  });

  test("random is checked when selected, regardless of dir", () => {
    const html = renderToString(<SortMenu sort="random" dir="desc" onChange={noop} open />);
    expect(html).toMatch(/✓<\/span>Random/);
  });
});
