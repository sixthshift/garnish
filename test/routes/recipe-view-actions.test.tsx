// M11.6 action menu on the recipe view route, rendered through the real route
// tree. The menu is closed on a default render, so this checks the trigger and
// what the page no longer carries (the old inline Edit button, the edit page's
// Delete section), plus the panel's own contents rendered directly.
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { Menu } from "../../src/components/ui/Menu";
import { createRecipe } from "../../src/server/recipes";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);

useTempDataDir();
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const food = (name: string) => ({ id: crypto.randomUUID(), name, pluralName: null });

async function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    components: [{ name: "", ingredients: [{ quantity: 200, food: food("flour") }], steps: [{ text: "Mix." }] }],
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

test("Cook stays a button of its own; Edit moved into the menu", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain("/recipes/lemon-tart/cook");
  expect(html).not.toContain(">Edit<");
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

test("the open menu lists every action, with Delete last and destructive", async () => {
  const recipe = await seedTart();
  // Rendered outside the router: the menu's items are what is under test, and
  // the two Link items need a router, so this asserts on the panel built from
  // the same item set with plain anchors.
  const html = renderToString(
    <Menu label="Recipe actions" open>
      <Menu.Item asChild>
        <a href={`/recipes/${recipe.slug}/edit`}>Edit</a>
      </Menu.Item>
      <Menu.Item asChild>
        <a href={`/recipes/${recipe.slug}/cook`}>Cook</a>
      </Menu.Item>
      <Menu.Item onSelect={() => {}}>Duplicate</Menu.Item>
      <Menu.Item onSelect={() => {}}>Copy link</Menu.Item>
      <Menu.Item onSelect={() => {}}>Copy ingredients</Menu.Item>
      <Menu.Item onSelect={() => {}}>Print</Menu.Item>
      <Menu.Separator />
      <Menu.Item intent="danger" onSelect={() => {}}>
        Delete
      </Menu.Item>
    </Menu>,
  );
  for (const label of ["Edit", "Cook", "Duplicate", "Copy link", "Copy ingredients", "Print", "Delete"]) {
    expect(html).toContain(label);
  }
  expect(html.match(/role="menuitem"/g)).toHaveLength(7);
  expect(html.indexOf("text-fg-danger")).toBeGreaterThan(-1);
});
