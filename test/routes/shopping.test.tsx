// The shopping list page (M31.4): what `ShoppingListView` renders for a list
// grouped by aisle, a row's sources expansion, the ticked group with its Clear
// ticked, and the empty state — plus the route end to end, loader and all,
// against a temp DATA_DIR.
//
// The view takes its writes as callbacks, so these render it directly; the
// route test below proves the loader and the wiring.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { shoppingItemSchema, type ShoppingItem } from "../../src/domain/shopping";
import { ShoppingListView, toBuyLabel } from "../../src/routes/shopping";
import { addShoppingItems } from "../../src/server/shopping";
import { createFood } from "../../src/server/foods";
import { findOrCreateAisle } from "../../src/server/aisles";
import { elementHtml, renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/shopping", local);
vi.mock("../../src/server/foods", local);
vi.mock("../../src/server/aisles", local);

const stamp = "2026-09-13T00:00:00.000Z";
const gram = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "gram", pluralName: "grams", abbreviation: "g", useAbbreviation: true, fraction: false, standardQuantity: null, standardUnitId: null };
const produce = { id: "11111111-aaaa-4aaa-8aaa-111111111111", name: "Produce", position: 2 };
const dairy = { id: "22222222-aaaa-4aaa-8aaa-222222222222", name: "Dairy", position: 0 };

function food(id: string, name: string, aisle: typeof produce | null) {
  return { id, name, pluralName: null, aliases: [], aisle, recipeId: null, skipShopping: false };
}

const lemons = food("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "lemon", produce);
const butter = food("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "butter", dairy);

let n = 0;
function item(overrides: Record<string, unknown> = {}): ShoppingItem {
  n += 1;
  return shoppingItemSchema.parse({
    id: `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`,
    position: n,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  });
}

const noop = () => {};
function render(items: ShoppingItem[]) {
  return renderToString(<ShoppingListView items={items} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} />);
}

describe("grouping", () => {
  test("a heading per aisle in position order, unassigned last", () => {
    const html = render([
      item({ quantity: 3, food: lemons }),
      item({ text: "Batteries" }),
      item({ quantity: 250, unit: gram, food: butter }),
    ]);
    const headings = [...html.matchAll(/data-testid="shopping-group"[^>]*>.*?<h2[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(headings).toEqual(["Dairy", "Produce", "Other"]);
    expect(html).toContain("250 g butter");
    expect(html).toContain("3 lemon");
    expect(html).toContain("Batteries");
    expect(html.match(/data-testid="shopping-row"/g)).toHaveLength(3);
    expect(html).toContain("3 items to buy");
  });

  test("a row is a tick box and a label, and nothing is ticked by default", () => {
    const html = render([item({ quantity: 3, food: lemons })]);
    const row = elementHtml(html, "shopping-row");
    expect(row).toContain('role="checkbox"');
    expect(row).toContain('aria-checked="false"');
    expect(row).toContain('aria-label="3 lemon"');
    expect(row).toContain('data-ticked="false"');
    // The row body is the tap target for the expansion, not a hover-only chevron.
    expect(row).toContain("<summary");
    expect(row).toContain("min-h-11");
  });
});

describe("the sources expansion", () => {
  test("a chevron row expands to the recipe, part and servings behind the line", () => {
    const html = render([
      item({
        quantity: 250,
        unit: gram,
        food: butter,
        sources: [
          { id: "55555555-5555-4555-8555-555555555555", recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 150 },
          { id: "66666666-6666-4666-8666-666666666666", recipeName: "Shortbread", partName: "", servings: 12, quantity: 100 },
        ],
      }),
    ]);
    const sources = elementHtml(html, "shopping-sources");
    expect(sources).toContain("Lemon tart, Pastry, serves 4");
    expect(sources).toContain("Shortbread, serves 12");
    expect(sources).toContain("Remove");
  });

  test("a hand-typed line says so rather than showing an empty expansion", () => {
    expect(elementHtml(render([item({ text: "Batteries" })]), "shopping-sources")).toContain("Added by hand");
  });
});

describe("the ticked group", () => {
  test("ticked rows sink to a Ticked group at the foot with Clear ticked", () => {
    const html = render([
      item({ quantity: 3, food: lemons, ticked: true }),
      item({ quantity: 250, unit: gram, food: butter }),
    ]);
    const headings = [...html.matchAll(/data-testid="shopping-group"[^>]*>.*?<h2[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(headings).toEqual(["Dairy", "Ticked"]);
    expect(html).toContain("Clear ticked");
    expect(html.match(/Clear ticked/g)).toHaveLength(1);
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("line-through");
    expect(html).toContain("1 item to buy"); // the ticked one is bought, not to buy
  });

  test("no ticked line, no Ticked group and no Clear ticked", () => {
    const html = render([item({ quantity: 3, food: lemons })]);
    expect(html).not.toContain("Clear ticked");
    expect(html).not.toContain(">Ticked<");
  });
});

describe("the empty state", () => {
  test("an empty list offers the box and the recipe route in, and no groups", () => {
    const html = render([]);
    expect(html).toContain("Nothing on the list.");
    expect(html).toContain("ingredients from its page");
    expect(html).toContain('aria-label="Add an item"');
    expect(html).not.toContain('data-testid="shopping-groups"');
    expect(html).not.toContain("items to buy");
  });
});

test("toBuyLabel counts only the unticked lines", () => {
  expect(toBuyLabel([])).toBe("0 items to buy");
  expect(toBuyLabel([item({ text: "Milk" })])).toBe("1 item to buy");
  expect(toBuyLabel([item({ text: "Milk" }), item({ text: "Eggs", ticked: true })])).toBe("1 item to buy");
});

describe("/shopping", () => {
  useTempDataDir();

  test("an empty database renders the empty state inside the shell", async () => {
    const html = await renderRoute("/shopping");
    expect(html).toContain("Nothing on the list.");
    // The nav item sits between Recipes and Settings, in both navs.
    expect(html.match(/>Shopping<\/a>/g)).toHaveLength(2);
    expect(html.indexOf(">Recipes</a>")).toBeLessThan(html.indexOf(">Shopping</a>"));
    expect(html.indexOf(">Shopping</a>")).toBeLessThan(html.indexOf(">Settings</a>"));
  });

  test("the loader reads the stored list and the page groups it", async () => {
    const aisle = await callServerFn(findOrCreateAisle, { name: "Dairy" });
    const created = await callServerFn(createFood, { name: "butter", aisleId: aisle.id });
    await callServerFn(addShoppingItems, {
      items: [
        { quantity: 250, foodId: created.id, sources: [{ recipeName: "Lemon tart", partName: "Pastry", servings: 4, quantity: 250 }] },
        { text: "Batteries" },
      ],
    });
    const html = await renderRoute("/shopping");
    expect(html).toContain("Dairy");
    expect(html).toContain("250 butter");
    expect(html).toContain("Lemon tart, Pastry, serves 4");
    expect(html).toContain("Batteries");
    expect(html).toContain("Other");
    expect(html).toContain("2 items to buy");
  });
});
