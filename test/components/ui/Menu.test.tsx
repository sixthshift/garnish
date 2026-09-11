// The local Menu primitive: the pure arrow-key helper, and what the menu
// renders closed and open on the server (the test environment is node, so a
// controlled `open` is how the panel gets into the markup).
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Menu, nextMenuIndex } from "../../../src/components/ui/Menu";

describe("nextMenuIndex", () => {
  test.each([
    [-1, 3, "ArrowDown", 0],
    [0, 3, "ArrowDown", 1],
    [2, 3, "ArrowDown", 0], // wraps to the top
    [-1, 3, "ArrowUp", 2],
    [0, 3, "ArrowUp", 2], // wraps to the bottom
    [2, 3, "ArrowUp", 1],
    [1, 3, "Home", 0],
    [1, 3, "End", 2],
  ])("from %i of %i, %s lands on %i", (current, count, key, expected) => {
    expect(nextMenuIndex(current, count, key)).toBe(expected);
  });

  test("a key the menu does not handle is null", () => {
    expect(nextMenuIndex(0, 3, "a")).toBeNull();
    expect(nextMenuIndex(0, 3, "Escape")).toBeNull();
  });

  test("an empty menu has nowhere to go", () => {
    expect(nextMenuIndex(-1, 0, "ArrowDown")).toBeNull();
  });
});

describe("Menu", () => {
  const items = (
    <>
      <Menu.Item onSelect={() => {}}>Duplicate</Menu.Item>
      <Menu.Separator />
      <Menu.Item intent="danger" onSelect={() => {}}>
        Delete
      </Menu.Item>
    </>
  );

  test("closed, only the trigger is in the markup", () => {
    const html = renderToString(<Menu label="Recipe actions">{items}</Menu>);
    expect(html).toContain('data-testid="menu-trigger"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("Duplicate");
  });

  test("open, the panel carries the items as menuitems", () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        {items}
      </Menu>,
    );
    expect(html).toContain('data-testid="menu-panel"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('aria-label="Recipe actions"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
    expect(html).toContain("Duplicate");
    expect(html).toContain("Delete");
    expect(html).toContain('role="separator"');
  });

  test("iconOnly names the trigger with the label instead of showing it", () => {
    const html = renderToString(
      <Menu label="Recipe actions" iconOnly>
        {items}
      </Menu>,
    );
    expect(html).toContain('aria-label="Recipe actions"');
    expect(html).toContain("⋯");
  });

  test("a danger item is painted as destructive", () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        {items}
      </Menu>,
    );
    expect(html).toMatch(/text-fg-danger[^>]*>Delete|Delete/);
    expect(html).toContain("text-fg-danger");
  });

  test("asChild hands the item's role and class to the child element", () => {
    const html = renderToString(
      <Menu label="Recipe actions" open>
        <Menu.Item asChild>
          <a href="/recipes/lemon-tart/edit">Edit</a>
        </Menu.Item>
      </Menu>,
    );
    expect(html).toMatch(/<a [^>]*href="\/recipes\/lemon-tart\/edit"[^>]*role="menuitem"|<a [^>]*role="menuitem"[^>]*href="\/recipes\/lemon-tart\/edit"/);
    expect(html).toContain("Edit");
  });

  test("a disabled item renders disabled", () => {
    const html = renderToString(
      <Menu label="Actions" open>
        <Menu.Item disabled onSelect={() => {}}>
          Duplicate
        </Menu.Item>
      </Menu>,
    );
    expect(html).toContain("disabled");
  });
});
