// A phone's Settings › Foods (decisions.md row 208): the foods filed by
// letter with an alphabet down the side that jumps to one, a row dragged left
// to delete through the same confirm as its menu, and a tap opening the food
// in a sheet whose aisle chips save on a tap.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FoodsList, foodListItems, letterOf } from "../../../../../../src/app/features/settings/components/mobile/FoodsList";
import type { RecipeSummary } from "../../../../../../src/domain/recipes/recipe";
import { noFacets } from "../../../../../../src/domain/recipes/recipe";
import type { Aisle, FoodRow } from "../../../../../../src/domain/recipes/reference";
import { renderInRouter } from "../../../../../helpers/dom";

const rpc = vi.hoisted(() => ({
  updateFood: vi.fn(async ({ data }: { data: { id: string } }) => data),
  usingFood: vi.fn(async (_: { data: { id: string } }): Promise<unknown[]> => []),
  deleteFood: vi.fn(async () => undefined),
  mergeFood: vi.fn(),
  createFood: vi.fn(),
  setFoodPacks: vi.fn(),
}));
vi.mock("../../../../../../src/api/rpc/foods", () => rpc);
vi.mock("../../../../../../src/api/rpc/aisles", () => ({ findOrCreateAisle: vi.fn() }));

const pantry: Aisle = { id: "aisle-pantry", name: "Pantry", position: 0 };
const produce: Aisle = { id: "aisle-produce", name: "Produce", position: 1 };

function food(id: string, name: string, extra: Partial<FoodRow> = {}): FoodRow {
  return { id, name, pluralName: null, aliases: [], aisleId: null, recipeId: null, skipShopping: false, conversions: [], ...extra };
}

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
  facets: noFacets(),
  tags: [],
  ingredientPreview: [],
};

const foods = [
  food("food-apple", "apple", { aisleId: produce.id }),
  food("food-basil", "basil", { aliases: ["sweet basil"], aisleId: produce.id }),
  food("food-flour", "flour", { aliases: ["plain flour"], aisleId: pantry.id }),
  food("food-mango", "mango"),
  food("food-zaatar", "Za'atar"),
  food("food-00", "00 flour"),
];

/** A long list, as a real library is, so a jump has somewhere to scroll to. */
const many = [
  ...foods,
  ..."ACDEGHKLNPRSTW".split("").flatMap((letter) => Array.from({ length: 6 }, (_, n) => food(`food-${letter}${n}`, `${letter.toLowerCase()}food ${n}`))),
];

async function list(all: FoodRow[] = foods) {
  return renderInRouter(<FoodsList foods={all} usage={{ "food-flour": 1 }} aisles={[pantry, produce]} units={[]} recipes={[shortbread]} />);
}

/**
 * The list over foods that a save changes, as the page's reload would: the
 * update the mock receives is applied to the list it draws.
 */
function Live({ initial }: { initial: FoodRow[] }) {
  const [all, setAll] = useState(initial);
  rpc.updateFood.mockImplementation(async ({ data }: { data: { id: string } }) => {
    setAll((list) => list.map((one) => (one.id === data.id ? { ...one, ...data } : one)));
    return data;
  });
  return <FoodsList foods={all} usage={{ "food-flour": 1 }} aisles={[pantry, produce]} units={[]} recipes={[shortbread]} />;
}

beforeEach(() => {
  for (const fn of Object.values(rpc)) fn.mockClear();
});
afterEach(() => vi.restoreAllMocks());

test("foods are filed A to Z under their letter, with # last for a name that starts with anything else", () => {
  expect(letterOf("Éclair")).toBe("E");
  expect(letterOf("00 flour")).toBe("#");
  expect(foodListItems(foods).map((item) => (item.kind === "letter" ? item.letter : item.food.name))).toEqual([
    "A",
    "apple",
    "B",
    "basil",
    "F",
    "flour",
    "M",
    "mango",
    "Z",
    "Za'atar",
    "#",
    "00 flour",
  ]);
});

describe("the alphabet down the side", () => {
  test("a letter with foods jumps to its header; one without is greyed and does nothing", async () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // The page's height, which a DOM without layout does not have: a jump is held within it.
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(20000);
    await list(many);
    const strip = screen.getByRole("navigation", { name: "Jump to a letter" });
    expect(within(strip).getByRole("button", { name: "Jump to Q" }).hasAttribute("disabled")).toBe(true);
    expect(within(strip).getByRole("button", { name: "Jump to #" })).toBeTruthy();

    fireEvent.click(within(strip).getByRole("button", { name: "Jump to M" }));
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    const firstJump = scroll.mock.calls.at(-1)?.[0] as ScrollToOptions;
    fireEvent.click(within(strip).getByRole("button", { name: "Jump to Z" }));
    await waitFor(() => expect((scroll.mock.calls.at(-1)?.[0] as ScrollToOptions).top).toBeGreaterThan(firstJump.top ?? 0));
  });

  test("the search narrows the list and the alphabet with it, by any name a food goes by", async () => {
    const user = userEvent.setup();
    await list();
    await user.type(screen.getByRole("textbox", { name: "Search foods" }), "sweet");
    expect(screen.getByRole("button", { name: /^basil/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^apple/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Jump to A" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Jump to B" }).hasAttribute("disabled")).toBe(false);
  });
});

test("a row dragged left past the line asks to delete the food, as its menu's Delete does", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    await list();
    const row = screen.getByRole("button", { name: /^mango/ }).closest("[data-swipe-row]") as HTMLElement;
    fireEvent.pointerDown(row, { pointerId: 3, pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerMove(row, { pointerId: 3, pointerType: "touch", clientX: 250, clientY: 101 });
    fireEvent.pointerMove(row, { pointerId: 3, pointerType: "touch", clientX: 150, clientY: 102 });
    fireEvent.pointerUp(row, { pointerId: 3, pointerType: "touch", clientX: 150, clientY: 102 });
    await vi.advanceTimersByTimeAsync(250);
    const confirm = await screen.findByRole("dialog");
    expect(confirm.textContent).toContain("mango");
    expect(rpc.usingFood).toHaveBeenCalledWith({ data: { id: "food-mango" } });
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(rpc.deleteFood).toHaveBeenCalledWith({ data: { id: "food-mango" } }));
  } finally {
    vi.useRealTimers();
  }
});

test("a tap opens the food's sheet: its names, its aisle as chips that save on a tap, and what uses it", async () => {
  rpc.usingFood.mockResolvedValueOnce([shortbread]);
  const user = userEvent.setup();
  await renderInRouter(<Live initial={foods} />);
  await user.click(screen.getByRole("button", { name: /^flour/ }));
  const sheet = await screen.findByRole("dialog", { name: "flour" });
  expect(within(sheet).getByText("plain flour")).toBeTruthy();
  expect(await within(sheet).findByRole("link", { name: "Shortbread" })).toBeTruthy();
  expect(within(sheet).getByRole("heading", { name: "Used in 1 recipe" })).toBeTruthy();

  const aisle = within(sheet).getByRole("group", { name: "Aisle" });
  expect(within(aisle).getByRole("button", { name: "Pantry" }).getAttribute("aria-pressed")).toBe("true");
  // Held unanswered, as a slow network would: the chip shows the new aisle at once, before the reload.
  rpc.updateFood.mockReturnValueOnce(new Promise(() => {}));
  await user.click(within(aisle).getByRole("button", { name: "Produce" }));
  expect(rpc.updateFood).toHaveBeenCalledWith({ data: { id: "food-flour", aisleId: produce.id } });
  await waitFor(() => expect(within(aisle).getByRole("button", { name: "Produce" }).getAttribute("aria-pressed")).toBe("true"));

  // A name comes off with its ×, and another goes on.
  await user.click(within(sheet).getByRole("button", { name: "Remove plain flour" }));
  expect(rpc.updateFood).toHaveBeenLastCalledWith({ data: { id: "food-flour", aliases: [] } });
  await waitFor(() => expect(within(sheet).queryByText("plain flour")).toBeNull());
  await user.click(within(sheet).getByRole("button", { name: "+ Add a name" }));
  await user.type(within(sheet).getByRole("textbox", { name: "New name" }), "wheat flour{Enter}");
  expect(rpc.updateFood).toHaveBeenLastCalledWith({ data: { id: "food-flour", aliases: ["wheat flour"] } });
  // The row under the sheet says so too.
  await waitFor(() => expect(screen.getByRole("button", { name: /^flour/, hidden: true }).textContent).toContain("wheat flour"));
});
