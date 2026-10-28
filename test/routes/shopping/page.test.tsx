// The shopping list page (M31.4): what `ShoppingListView` renders for a list
// grouped by aisle, a row's sources expansion, the ticked group with its Clear
// ticked, and the empty state — plus the route end to end, loader and all,
// against a temp DATA_DIR.
//
// The view takes its writes as callbacks, so these render it directly; the
// route test below proves the loader and the wiring.
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { type ShoppingItem, shoppingItemSchema } from "../../../src/domain/shopping";
import { applyOutbox, createOutbox, readOutbox, type StorageLike } from "../../../src/lib/outbox";
import { ShoppingListView } from "../../../src/routes/shopping/components/ShoppingListView";
import { sendOutboxEntry, toBuyLabel } from "../../../src/routes/shopping/components/shoppingListActions";
import { findOrCreateAisle } from "../../../src/server/fns/aisles";
import { createFood } from "../../../src/server/fns/foods";
import { addShoppingItems, listShoppingItems } from "../../../src/server/fns/shopping";
import { elementHtml, renderRoute } from "../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../src/server/fns/shopping", local);
vi.mock("../../../src/server/fns/foods", local);
vi.mock("../../../src/server/fns/aisles", local);
vi.mock("../../../src/server/fns/units", local);

const stamp = "2026-09-13T00:00:00.000Z";
const gram = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};
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
    const html = render([item({ quantity: 3, food: lemons }), item({ text: "Batteries" }), item({ quantity: 250, unit: gram, food: butter })]);
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
    // The line's text is a phone-sized target that ticks it too.
    expect(row).toContain("min-h-11");
  });
});

describe("the row (row 187)", () => {
  test("no expanding part: the line, the dishes under it, and a remove for each way of pointing", () => {
    const html = render([
      item({
        quantity: 250,
        unit: gram,
        food: butter,
        sources: [{ id: "55555555-5555-4555-8555-555555555555", recipeName: "Lemon tart", servings: 4, quantity: 250 }],
      }),
    ]);
    expect(html).not.toContain("<details");
    expect(elementHtml(html, "shopping-meals")).toContain("Lemon tart");
    // The trash with a mouse, and the Delete a swipe shows on a touch screen: each is displayed on one kind of screen only.
    expect(html.match(/aria-label="Remove 250 g butter"/g)).toHaveLength(2);
    expect(elementHtml(html, "shopping-remove")).toContain("[@media(hover:hover)]:flex");
    expect(html).toContain(">Delete<");
  });

  test("a dish whose recipe is gone is named but not linked", () => {
    const html = render([
      item({ quantity: 250, unit: gram, food: butter, sources: [{ id: "55555555-5555-4555-8555-555555555555", recipeName: "Lemon tart" }] }),
    ]);
    expect(elementHtml(html, "shopping-meals")).not.toContain("<a ");
  });
});

describe("the ticked group", () => {
  test("ticked rows sink to a Ticked group at the foot with Clear ticked", () => {
    const html = render([item({ quantity: 3, food: lemons, ticked: true }), item({ quantity: 250, unit: gram, food: butter })]);
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

describe("the meal view", () => {
  const TART = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
  const tart = { id: "5a5a5a5a-5a5a-4a5a-8a5a-000000000001", recipeId: TART, recipeName: "Lemon tart", partName: "Mon 26 Oct", planDate: "2026-10-26" };
  const soup = { id: "5a5a5a5a-5a5a-4a5a-8a5a-000000000002", recipeName: "Soup", partName: "Wed 28 Oct", planDate: "2026-10-28" };
  const renderMeals = (items: ShoppingItem[]) =>
    renderToString(<ShoppingListView items={items} view="meals" onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} />);
  const headings = (html: string) => [...html.matchAll(/data-testid="shopping-group"[^>]*>.*?<h2[^>]*>([^<]+)</g)].map((match) => match[1]);

  test("the toggle offers both views and marks the one shown", () => {
    for (const [html, on] of [
      [render([item({ text: "Batteries" })]), "Aisles"],
      [renderMeals([item({ text: "Batteries" })]), "Meals"],
    ] as const) {
      expect(html).toContain('aria-label="Group the list by"');
      expect(html).toMatch(new RegExp(`aria-checked="true"[^>]*>(<[^>]+>)*${on}`));
    }
  });

  test("a heading per dish with its day, in day order, hand-typed lines under Other", () => {
    const html = renderMeals([
      item({ text: "Batteries" }),
      item({ quantity: 1, food: lemons, sources: [{ ...soup, quantity: 1 }] }),
      item({ quantity: 3, food: lemons, sources: [{ ...tart, quantity: 3 }] }),
    ]);
    expect(html).toContain('data-view="meals"');
    expect(headings(html)).toEqual(["Lemon tart", "Soup", "Other"]);
    expect(html).toContain('aria-label="Lemon tart, Mon 26 Oct"');
    expect(html).toContain("Wed 28 Oct");
  });

  test("a shared line shows each dish its share", () => {
    const html = renderMeals([
      item({
        quantity: 350,
        unit: gram,
        food: butter,
        sources: [
          { ...tart, quantity: 200 },
          { ...soup, quantity: 150 },
        ],
      }),
    ]);
    const rows = html.split('data-testid="shopping-row"').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("200 g butter");
    expect(rows[1]).toContain("150 g butter");
  });

  test("the aisle view says under each line which dishes it is for, with each share of a shared line, and nothing under a typed line", () => {
    const html = render([
      item({
        quantity: 350,
        unit: gram,
        food: butter,
        sources: [
          { ...tart, quantity: 200 },
          { ...soup, quantity: 150 },
        ],
      }),
      item({ text: "Batteries" }),
    ]);
    expect(html.match(/data-testid="shopping-meals"/g)).toHaveLength(1);
    expect(elementHtml(html, "shopping-meals")).toMatch(/Lemon tart Mon 200 g.* · .*Soup Wed 150 g/);
    expect(html).toContain('aria-label="350 g butter"');
  });

  test("the meal view does not repeat the dish under its own rows", () => {
    expect(renderMeals([item({ quantity: 3, food: lemons, sources: [{ ...tart, quantity: 3 }] })])).not.toContain("shopping-meals");
  });

  test("a ticked line stays under its dish, and there is no Ticked group", () => {
    const html = renderMeals([item({ quantity: 3, food: lemons, ticked: true, sources: [{ ...tart, quantity: 3 }] })]);
    expect(headings(html)).toEqual(["Lemon tart"]);
    expect(elementHtml(html, "shopping-row")).toContain('data-ticked="true"');
    expect(html).not.toContain("Clear ticked");
  });
});

describe("pack sizes (row 184)", () => {
  const each = { foodId: lemons.id, quantity: 1, unitId: null };
  const block250 = { id: "7a7a7a7a-7a7a-4a7a-8a7a-000000000001", foodId: butter.id, quantity: 250, unitId: gram.id };
  const block500 = { id: "7a7a7a7a-7a7a-4a7a-8a7a-000000000002", foodId: butter.id, quantity: 500, unitId: gram.id };
  const units = [{ ...gram, portion: false }];
  const renderPacks = (items: ShoppingItem[], packs: unknown[], view: "aisles" | "meals" = "aisles") =>
    renderToString(
      <ShoppingListView items={items} view={view} packs={packs as never} units={units} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} />
    );

  test("the aisle view rounds a line up to whole packs", () => {
    const html = renderPacks([item({ quantity: 400, unit: gram, food: butter })], [block250]);
    expect(elementHtml(html, "shopping-packs")).toContain("→ 2 × 250 g");
  });

  test("several sizes: the least over, then the fewest packs", () => {
    expect(elementHtml(renderPacks([item({ quantity: 450, unit: gram, food: butter })], [block250, block500]), "shopping-packs")).toContain("→ 1 × 500 g");
  });

  test("a food with no size, a typed line and the meal view say nothing about packs", () => {
    expect(renderPacks([item({ quantity: 400, unit: gram, food: butter }), item({ text: "Batteries" })], [])).not.toContain("shopping-packs");
    expect(renderPacks([item({ quantity: 400, unit: gram, food: butter, sources: [] })], [block250], "meals")).not.toContain("shopping-packs");
  });

  test("an each size rounds a half lemon to one", () => {
    const html = renderPacks([item({ quantity: 0.5, food: lemons })], [{ id: "7a7a7a7a-7a7a-4a7a-8a7a-000000000003", ...each }]);
    expect(elementHtml(html, "shopping-packs")).toContain("→ 1");
  });

  test("no Sold in form on the list: a size is set in the food's own sheet", () => {
    const html = renderPacks([item({ quantity: 400, unit: gram, food: butter })], [block250]);
    expect(html).not.toContain("Sold in");
    expect(html).not.toContain("Add size");
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
    // The nav item sits between Plan and Recipes, in both navs.
    expect(html.match(/>Shopping<\/a>/g)).toHaveLength(2);
    expect(html.indexOf(">Plan</a>")).toBeLessThan(html.indexOf(">Shopping</a>"));
    expect(html.indexOf(">Shopping</a>")).toBeLessThan(html.indexOf(">Recipes</a>"));
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
    expect(elementHtml(html, "shopping-meals")).toContain("Lemon tart");
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
      <ShoppingListView items={applyOutbox([lemon], outbox.list())} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} offline />
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
      />
    );
    expect(after).toContain('data-ticked="true"');
    expect(after).toContain('aria-checked="true"');
    expect(after).toContain("1 change waiting");
    // And it survives the phone closing the tab in the car park.
    expect(readOutbox(storage).map((entry) => [entry.itemId, entry.kind])).toEqual([[lemon.id, "tick"]]);
  });

  test("offline, clearing the ticked is refused, but the add box stays open: a typed line queues", () => {
    const html = renderToString(
      <ShoppingListView items={[item({ quantity: 3, food: lemons, ticked: true })]} onAdd={noop} onTick={noop} onRemove={noop} onClearTicked={noop} offline />
    );
    expect(elementHtml(html, "shopping-add")).not.toMatch(/\sdisabled(=""|\s|>)/);
    const clear = html.match(/<button[^>]*>Clear ticked</)?.[0] ?? "";
    expect(clear).toMatch(/\sdisabled(=""|\s|>)/);
  });

  test("a line typed offline shows on the list at once, unassigned, and counts as waiting", () => {
    const lemon = item({ quantity: 3, food: lemons });
    const storage = memoryStorage();
    const outbox = createOutbox(storage);
    outbox.add("local-id", "Batteries");
    const html = renderToString(
      <ShoppingListView
        items={applyOutbox([lemon], outbox.list())}
        onAdd={noop}
        onTick={noop}
        onRemove={noop}
        onClearTicked={noop}
        pending={outbox.list().length}
        offline
      />
    );
    expect(html).toContain("Batteries");
    expect(html).toContain("1 change waiting");
    expect(html).toContain("2 items to buy");
    expect(readOutbox(storage)).toMatchObject([{ itemId: "local-id", kind: "add", text: "Batteries", ticked: false }]);
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

  test("a queued line lands as a hand-typed row under the server's own id, ticked as it was queued", async () => {
    await sendOutboxEntry({ id: "e4", itemId: "local-id", kind: "add", text: "Candles", ticked: true, at: stamp });
    const candles = (await listShoppingItems()).find((row) => row.text === "Candles");
    expect(candles).toMatchObject({ ticked: true, food: null, sources: [] });
    expect(candles?.id).not.toBe("local-id");
  });
});
