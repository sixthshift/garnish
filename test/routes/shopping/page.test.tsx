// The shopping list page (M31.4): what `ShoppingListView` renders for a list
// grouped by aisle, a row's sources expansion, the ticked group with its Clear
// ticked, and the empty state — plus the route end to end, loader and all,
// against a temp DATA_DIR.
//
// The view takes its writes as callbacks, so these render it directly; the
// route test below proves the loader and the wiring.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { shoppingItemSchema, type ShoppingItem } from "../../../src/domain/shopping";
import { ShoppingListView, sendOutboxEntry, setFoodAisle } from "../../../src/routes/shopping/components/ShoppingListView";
import { toBuyLabel } from "../../../src/routes/shopping/components/ShoppingListView";
import { applyOutbox, createOutbox, readOutbox, type StorageLike } from "../../../src/lib/outbox";
import { addShoppingItems, listShoppingItems } from "../../../src/server/fns/shopping";
import { createFood, listFoods } from "../../../src/server/fns/foods";
import { findOrCreateAisle } from "../../../src/server/fns/aisles";
import { elementHtml, renderRoute } from "../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../src/server/fns/shopping", local);
vi.mock("../../../src/server/fns/foods", local);
vi.mock("../../../src/server/fns/aisles", local);

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

describe("Set aisle (M31.6)", () => {
  const unaisled = food("ffffffff-ffff-4fff-8fff-ffffffffffff", "flour", null);

  test("the control shows only on a food line with no aisle, not an aisled food or a hand-typed line", () => {
    const html = renderToString(
      <ShoppingListView
        items={[item({ quantity: 3, food: lemons }), item({ quantity: 400, food: unaisled }), item({ text: "Batteries" })]}
        aisles={[produce, dairy]}
        onAdd={noop}
        onTick={noop}
        onRemove={noop}
        onClearTicked={noop}
      />,
    );
    expect(html.match(/data-testid="shopping-set-aisle"/g)).toHaveLength(1);
    expect(html).toContain("Set aisle");
    expect(html).toContain('aria-label="Aisle for flour"');
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

// --- M31.5, ticking with no server -------------------------------------------
// The page's offline path is: push onto the outbox, render the list with the
// queue applied. These drive the same two functions the route component does.

describe("an offline tick", () => {
  function memoryStorage(): StorageLike & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
  }

  test("shows ticked, queues the write, and says how many are waiting", () => {
    const lemon = item({ quantity: 3, food: lemons });
    const storage = memoryStorage();
    const outbox = createOutbox(storage);

    // Before the tap: nothing queued, nothing ticked, no badge.
    const before = renderToString(
      <ShoppingListView items={applyOutbox([lemon], outbox.list())} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} offline />,
    );
    expect(before).toContain('data-ticked="false"');
    expect(before).not.toContain('data-testid="shopping-pending"');

    outbox.push(lemon.id, "tick");

    const after = renderToString(
      <ShoppingListView
        items={applyOutbox([lemon], outbox.list())}
        onAdd={noop}
        onTick={noop}
        onRemove={noop}
        onClearTicked={noop}
        pending={outbox.list().length}
        offline
      />,
    );
    expect(after).toContain('data-ticked="true"');
    expect(after).toContain('aria-checked="true"');
    expect(after).toContain("1 change waiting");
    // And it survives the phone closing the tab in the car park.
    expect(readOutbox(storage).map((entry) => [entry.itemId, entry.kind])).toEqual([[lemon.id, "tick"]]);
  });

  test("offline, adding a line and clearing the ticked are refused: they are not tick writes", () => {
    const html = renderToString(
      <ShoppingListView
        items={[item({ quantity: 3, food: lemons, ticked: true })]}
        onAdd={noop}
        onTick={noop}
        onRemove={noop}
        onClearTicked={noop}
        offline
      />,
    );
    expect(elementHtml(html, "shopping-add")).toMatch(/\sdisabled(=""|\s|>)/);
    const clear = html.match(/<button[^>]*>Clear ticked</)?.[0] ?? "";
    expect(clear).toMatch(/\sdisabled(=""|\s|>)/);
  });
});

describe("sendOutboxEntry", () => {
  useTempDataDir();

  test("a queued tick, untick and remove each reach the server", async () => {
    await callServerFn(addShoppingItems, { items: [{ text: "Batteries" }, { text: "Milk" }] });
    const [batteries, milk] = await listShoppingItems();

    await sendOutboxEntry({ id: "e1", itemId: batteries!.id, kind: "tick", at: stamp });
    expect((await listShoppingItems()).find((row) => row.id === batteries!.id)?.ticked).toBe(true);

    await sendOutboxEntry({ id: "e2", itemId: batteries!.id, kind: "untick", at: stamp });
    expect((await listShoppingItems()).find((row) => row.id === batteries!.id)?.ticked).toBe(false);

    await sendOutboxEntry({ id: "e3", itemId: milk!.id, kind: "remove", at: stamp });
    expect((await listShoppingItems()).map((row) => row.id)).toEqual([batteries!.id]);
  });
});

describe("setFoodAisle", () => {
  useTempDataDir();

  test("choosing an aisle writes the food", async () => {
    const aisle = await callServerFn(findOrCreateAisle, { name: "Baking" });
    const created = await callServerFn(createFood, { name: "flour" });
    expect(created.aisleId).toBeNull();

    await setFoodAisle(created.id, aisle.id);

    const updated = (await listFoods({ data: {} })).find((row) => row.id === created.id);
    expect(updated?.aisleId).toBe(aisle.id);
  });
});
