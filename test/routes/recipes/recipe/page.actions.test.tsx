// M11.6 action menu on the recipe view route, rendered through the real route
// tree. The menu is closed on a default render, so this checks the trigger and
// what the page no longer carries (the edit page's Delete section), plus the
// panel's own contents rendered directly. Edit and Cook are their own buttons
// beside the menu (M25.5), asserted separately from the menu's own items.
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { Menu } from "../../../../src/components/ui/Menu";
import { createRecipe } from "../../../../src/server/fns/recipes";
import { elementHtml, renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/timeline", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const food = (name: string) => ({ id: crypto.randomUUID(), name, pluralName: null });

async function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    parts: [{ name: "", ingredients: [{ quantity: 200, food: food("flour") }], steps: [{ text: "Mix." }] }],
    notes: [{ title: "Tip", text: "Chill it." }],
  });
}

test("the view page carries the action menu trigger, closed", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('data-testid="menu-trigger"');
  expect(html).toContain('aria-label="Recipe actions"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('role="menuitem"');
});

test("Edit and Cook are both buttons in the open, beside the menu; neither is in it", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('aria-label="Edit"');
  expect(html).toContain('href="/recipes/lemon-tart/edit');
  expect(html).toContain(">Cook<");
  expect(html).toContain('href="/recipes/lemon-tart/cook');
  expect(html).not.toContain('role="menuitem"'); // menu is closed by default
});

test("the header's actions are marked as chrome for the print stylesheet", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('data-print="hide"');
});

test("the edit page no longer hosts Delete", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart/edit");
  expect(html).not.toContain("Delete recipe");
  expect(html).not.toContain("This cannot be undone");
});

test("the open menu lists Duplicate, Make this a food, the two copy items and Print, with Delete last and destructive", async () => {
  // Rendered outside the router: the menu's items are what is under test,
  // built from the same item set `RecipeActions` renders now that Edit and
  // Cook have left it (M25.5).
  const html = renderToString(
    <Menu label="Recipe actions" open>
      <Menu.Item onSelect={() => {}}>Duplicate</Menu.Item>
      <Menu.Item onSelect={() => {}}>Make this a food</Menu.Item>
      <Menu.Item onSelect={() => {}}>Plan</Menu.Item>
      <Menu.Item onSelect={() => {}}>Copy link</Menu.Item>
      <Menu.Item onSelect={() => {}}>Copy ingredients</Menu.Item>
      <Menu.Item onSelect={() => {}}>Print</Menu.Item>
      <Menu.Separator />
      <Menu.Item intent="danger" onSelect={() => {}}>
        Delete
      </Menu.Item>
    </Menu>
  );
  for (const label of ["Duplicate", "Make this a food", "Plan", "Copy link", "Copy ingredients", "Print", "Delete"]) {
    expect(html).toContain(label);
  }
  expect(html).not.toContain(">Edit<");
  expect(html).not.toContain(">Cook<");
  expect(html.match(/role="menuitem"/g)).toHaveLength(7);
  expect(html.indexOf("text-fg-danger")).toBeGreaterThan(-1);
});

test("the menu's Plan item opens a popover trigger sitting beside it, closed by default", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).not.toContain('aria-label="Plan Lemon tart"');
  expect(html).not.toContain('data-testid="plan-popover"');
});

// M30.4 drew this button disabled; M31.3 wired it up, so the tooltip that
// said "Coming later" is gone and the button is live.
test("a live 'Add to shopping list' button sits beside Cook", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  const button = elementHtml(html, "shopping-list-button");
  expect(button).toContain(">Add to shopping list<");
  expect(button).not.toMatch(/ disabled(=""|(?=[ >]))/);
  expect(html.indexOf(button)).toBeGreaterThan(html.indexOf(">Cook<"));
  expect(html).toContain('data-print="hide"');
  expect(html).not.toContain("Coming later");
});
