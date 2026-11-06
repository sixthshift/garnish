// A desktop's Settings › Foods (decisions.md row 207): a cell edits in place
// and saves through the same updateFood the sheet does, Esc puts it back; a
// click on a row opens its details beside the grid; ticked rows get a bar.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FoodsGrid } from "../../../../../../src/app/features/settings/components/desktop/FoodsGrid";
import type { RecipeSummary } from "../../../../../../src/domain/recipes/recipe";
import type { Aisle, FoodRow } from "../../../../../../src/domain/recipes/reference";
import { renderInRouter } from "../../../../../helpers/dom";
import { atDesktop } from "../../../../../helpers/layout";

const rpc = vi.hoisted(() => ({
  updateFood: vi.fn(async ({ data }: { data: { id: string } }) => data),
  usingFood: vi.fn(async (_: { data: { id: string } }): Promise<unknown[]> => []),
  deleteFood: vi.fn(),
  mergeFood: vi.fn(),
  createFood: vi.fn(),
  setFoodPacks: vi.fn(),
}));
vi.mock("../../../../../../src/api/rpc/foods", () => rpc);
vi.mock("../../../../../../src/api/rpc/aisles", () => ({ findOrCreateAisle: vi.fn() }));

atDesktop();

const pantry: Aisle = { id: "aisle-pantry", name: "Pantry", position: 0 };
const dairy: Aisle = { id: "aisle-dairy", name: "Dairy", position: 1 };

function food(id: string, name: string, extra: Partial<FoodRow> = {}): FoodRow {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [], ...extra };
}

const foods = [
  food("food-butter", "butter", { aliases: ["unsalted butter"], aisleId: dairy.id }),
  food("food-flour", "flour", { aliases: ["plain flour", "all-purpose flour"], aisleId: pantry.id }),
  food("food-sugar", "sugar", { aisleId: pantry.id }),
];

const shortbread: RecipeSummary = {
  id: "recipe-shortbread",
  slug: "shortbread",
  name: "Shortbread",
  image: null,
  rating: null,
  prepTime: null,
  performTime: null,
  totalTime: null,
  lastMade: null,
  favourite: false,
  kind: null,
  tags: [],
  ingredientPreview: [],
};

async function grid() {
  return renderInRouter(<FoodsGrid foods={foods} usage={{ "food-flour": 1 }} aisles={[pantry, dairy]} units={[]} recipes={[shortbread]} />);
}

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockClear();
});

describe("a cell edits in place", () => {
  test("a double-click opens the name; Enter saves it through updateFood and shows it at once", async () => {
    const user = userEvent.setup();
    await grid();
    await user.dblClick(screen.getByRole("button", { name: "Edit name: flour" }));
    const field = screen.getByRole("textbox", { name: "Edit name: flour" });
    expect(document.activeElement).toBe(field);
    await user.clear(field);
    await user.type(field, "plain flour{Enter}");

    expect(rpc.updateFood).toHaveBeenCalledWith({ data: { id: "food-flour", name: "plain flour" } });
    expect(screen.queryByRole("textbox", { name: /^Edit name/ })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute("data-cell")).toBe("food-flour:name"));
  });

  test("Enter on a cell opens it, commas part the aliases, and leaving the field saves", async () => {
    const user = userEvent.setup();
    await grid();
    screen.getByRole("button", { name: "Edit also called: sugar" }).focus();
    await user.keyboard("{Enter}");
    const field = screen.getByRole("textbox", { name: "Edit also called: sugar" });
    await user.type(field, "caster sugar,  white sugar, caster sugar");
    await user.tab();
    expect(rpc.updateFood).toHaveBeenCalledWith({ data: { id: "food-sugar", aliases: ["caster sugar", "white sugar"] } });
  });

  test("Esc puts the cell back and saves nothing", async () => {
    const user = userEvent.setup();
    await grid();
    await user.dblClick(screen.getByRole("button", { name: "Edit name: butter" }));
    await user.type(screen.getByRole("textbox", { name: "Edit name: butter" }), " (salted){Escape}");
    expect(screen.queryByRole("textbox", { name: /^Edit name/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit name: butter" }).textContent).toBe("butter");
    expect(rpc.updateFood).not.toHaveBeenCalled();
  });

  test("an empty name is refused rather than saved", async () => {
    const user = userEvent.setup();
    await grid();
    await user.dblClick(screen.getByRole("button", { name: "Edit name: sugar" }));
    await user.clear(screen.getByRole("textbox", { name: "Edit name: sugar" }));
    await user.keyboard("{Enter}");
    expect(rpc.updateFood).not.toHaveBeenCalled();
  });
});

describe("the details pane", () => {
  test("a click on a row opens its details: aliases as chips, the aisle, and the recipes that use it", async () => {
    rpc.usingFood.mockResolvedValueOnce([shortbread]);
    const user = userEvent.setup();
    await grid();
    await user.click(screen.getByRole("button", { name: "Edit aisle: flour" }));

    const pane = await screen.findByRole("region", { name: "flour" });
    expect(rpc.usingFood).toHaveBeenCalledWith({ data: { id: "food-flour" } });
    const aliases = within(pane).getByTestId("food-aliases");
    expect(aliases.textContent).toContain("plain flour");
    expect(aliases.textContent).toContain("all-purpose flour");
    expect(within(pane).getByRole("combobox", { name: "Aisle" }).textContent).toContain("Pantry");
    expect(await within(pane).findByRole("link", { name: "Shortbread" })).toBeTruthy();
    expect(within(pane).getByRole("heading", { name: "Used in 1 recipe" })).toBeTruthy();

    // A chip's × takes that alias off and saves the rest.
    await user.click(within(aliases).getAllByRole("button")[0]!);
    expect(rpc.updateFood).toHaveBeenCalledWith({ data: { id: "food-flour", aliases: ["all-purpose flour"] } });

    await user.click(within(pane).getByRole("button", { name: "Close the details" }));
    expect(screen.queryByRole("region", { name: "flour" })).toBeNull();
  });

  test("a name added in the pane joins the aliases", async () => {
    const user = userEvent.setup();
    await grid();
    await user.click(screen.getByRole("button", { name: "Edit aisle: sugar" }));
    const pane = await screen.findByRole("region", { name: "sugar" });
    await user.click(within(pane).getByRole("button", { name: "Add a name" }));
    await user.type(within(pane).getByRole("textbox", { name: "New name" }), "caster sugar{Enter}");
    expect(rpc.updateFood).toHaveBeenCalledWith({ data: { id: "food-sugar", aliases: ["caster sugar"] } });
  });

  test("the second click of a double-click edits the cell, and the pane does not open", async () => {
    const user = userEvent.setup();
    await grid();
    await user.dblClick(screen.getByRole("button", { name: "Edit name: sugar" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(screen.queryByRole("region", { name: "sugar" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Edit name: sugar" })).toBeTruthy();
  });
});

test("ticked rows get a bar: its Delete asks first, naming how many", async () => {
  const user = userEvent.setup();
  await grid();
  expect(screen.queryByTestId("bulk-bar")).toBeNull();
  await user.click(screen.getByRole("checkbox", { name: "Select butter" }));
  await user.click(screen.getByRole("checkbox", { name: "Select sugar" }));
  const bar = screen.getByRole("region", { name: "Selected foods" });
  expect(bar.textContent).toContain("2 selected");
  await user.click(within(bar).getByRole("button", { name: "Delete 2" }));
  const confirm = await screen.findByRole("dialog");
  expect(rpc.usingFood).toHaveBeenCalledTimes(2);
  expect(rpc.deleteFood).not.toHaveBeenCalled();

  await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(within(bar).getByRole("button", { name: "Clear" }));
  expect(screen.queryByRole("region", { name: "Selected foods" })).toBeNull();
});
