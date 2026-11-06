// Shopping on a phone, in the shop (decisions.md row 208): the meals as chips
// that narrow the list to one dish, big rows that a tap, the box or a swipe
// right put in the trolley, and the trolley as a bar at the foot that opens a
// sheet of what is in it, to take a line back out or clear it. The DOM
// window is a phone's (390 wide), so this is the phone's list.
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ShoppingListView } from "../../../../src/domain/shopping/components/ShoppingListView";
import { type ShoppingItem, shoppingItemSchema } from "../../../../src/domain/shopping/shopping";
import { renderInRouter } from "../../../helpers/dom";

const stamp = "2026-01-01T00:00:00.000Z";
const uuid = (prefix: string, n: number) => `${prefix}-9999-4999-8999-${String(n).padStart(12, "0")}`;
const dish = (n: number, recipeName: string, planDate: string) => ({ id: uuid("5a5a5a5a", n), recipeName, planDate });

function item(n: number, text: string, sources: ReturnType<typeof dish>[], ticked = false): ShoppingItem {
  return shoppingItemSchema.parse({ id: uuid("99999999", n), position: n, createdAt: stamp, updatedAt: stamp, text, ticked, sources });
}

const list = [
  item(1, "Butter", [dish(1, "Lemon tart", "2026-10-26"), dish(2, "Roast chicken", "2026-10-28")]),
  item(2, "Lemons", [dish(3, "Lemon tart", "2026-10-26")]),
  item(3, "Chicken", [dish(4, "Roast chicken", "2026-10-28")]),
  item(4, "Batteries", []),
  item(5, "Milk", [], true),
];

/** The page's wiring, with the writes kept here: a tick comes back as the list ticked. */
function Harness({ onTick, onClearTicked, offline }: { onTick: (id: string, ticked: boolean) => void; onClearTicked: () => void; offline: boolean }) {
  const [items, setItems] = useState(list);
  return (
    <ShoppingListView
      items={items}
      offline={offline}
      onAdd={() => {}}
      onRemove={() => {}}
      onClearTicked={() => {
        onClearTicked();
        setItems((current) => current.filter((line) => !line.ticked));
      }}
      onTick={(id, ticked) => {
        onTick(id, ticked);
        setItems((current) => current.map((line) => (line.id === id ? { ...line, ticked } : line)));
      }}
    />
  );
}

async function mount({ offline = false } = {}) {
  const onTick = vi.fn();
  const onClearTicked = vi.fn();
  await renderInRouter(<Harness onTick={onTick} onClearTicked={onClearTicked} offline={offline} />);
  return { onTick, onClearTicked };
}

afterEach(() => vi.useRealTimers());

/** The lines still in the aisles, by their boxes' names. */
const inAisles = () =>
  within(screen.getByTestId("shopping-groups"))
    .getAllByRole("checkbox")
    .map((box) => box.getAttribute("aria-label"));

test("the header says how far along the trip is, and there is no Aisles/Meals toggle", async () => {
  await mount();
  expect(screen.getByTestId("shopping-progress-label").textContent).toBe("1 of 5");
  expect(screen.getByRole("progressbar", { name: "In the trolley" })).toHaveAttribute("aria-valuetext", "1 of 5");
  expect(screen.queryByRole("radio", { name: "Meals" })).toBeNull();
});

test("a meal chip narrows the list to that dish's lines, All undoes it, and each line keeps its dishes", async () => {
  const user = userEvent.setup();
  await mount();
  const chips = screen.getByRole("group", { name: "Meals" });
  expect(within(chips).getByRole("button", { name: "All · 4" })).toHaveAttribute("aria-pressed", "true");
  expect(inAisles()).toEqual(["Butter", "Lemons", "Chicken", "Batteries"]);

  const chicken = within(chips).getByRole("button", { name: "Roast chicken, Wed: 2 to buy" });
  await user.click(chicken);
  expect(chicken).toHaveAttribute("aria-pressed", "true");
  expect(inAisles()).toEqual(["Butter", "Chicken"]);
  // A shared line still says both dishes it is for.
  expect(within(screen.getByRole("checkbox", { name: "Butter" }).closest("li")!).getByTestId("shopping-meals").textContent).toBe(
    "Lemon tart Mon · Roast chicken Wed"
  );

  await user.click(within(chips).getByRole("button", { name: "All · 4" }));
  expect(inAisles()).toEqual(["Butter", "Lemons", "Chicken", "Batteries"]);

  // Pressing the chosen chip again lets it go too.
  await user.click(chicken);
  await user.click(chicken);
  expect(within(chips).getByRole("button", { name: "All · 4" })).toHaveAttribute("aria-pressed", "true");
});

test("a meal all in the trolley says so", async () => {
  const user = userEvent.setup();
  await mount();
  await user.click(screen.getByRole("button", { name: "Roast chicken, Wed: 2 to buy" }));
  await user.click(screen.getByRole("checkbox", { name: "Butter" }));
  await user.click(screen.getByRole("checkbox", { name: "Chicken" }));
  expect(screen.queryByTestId("shopping-groups")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("All of Roast chicken is in the trolley.");
  expect(screen.getByRole("button", { name: "Roast chicken, Wed: 0 to buy" })).toHaveAttribute("aria-pressed", "true");
});

test("a swipe right puts a line in the trolley, and is not also a tap", async () => {
  vi.useFakeTimers();
  const { onTick } = await mount();
  const row = screen.getByText("Lemons");
  const at = (x: number) => ({ pointerType: "touch", pointerId: 1, clientX: x, clientY: 10 });
  fireEvent.pointerDown(row, at(100));
  fireEvent.pointerMove(row, at(120));
  fireEvent.pointerMove(row, at(240));
  // The green under the row says what letting go will do.
  expect(screen.getByText("In the trolley")).toBeInTheDocument();
  fireEvent.pointerUp(row, at(240));
  fireEvent.click(row);
  act(() => vi.advanceTimersByTime(200));
  expect(onTick).toHaveBeenCalledTimes(1);
  expect(onTick).toHaveBeenCalledWith(uuid("99999999", 2), true);
  expect(screen.queryByRole("checkbox", { name: "Lemons" })).toBeNull();
  expect(screen.getByRole("button", { name: /2 in the trolley/ })).toBeInTheDocument();
});

test("a swipe left still opens the row's own Delete, rather than ticking it", async () => {
  const { onTick } = await mount();
  const body = screen.getByRole("checkbox", { name: "Lemons" }).closest<HTMLElement>("[data-testid=shopping-row-body]")!;
  const at = (x: number) => ({ pointerType: "touch", pointerId: 1, clientX: x, clientY: 10 });
  fireEvent.pointerDown(body, at(200));
  fireEvent.pointerMove(body, at(150));
  fireEvent.pointerMove(body, at(100));
  fireEvent.pointerUp(body, at(100));
  expect(body.style.transform).toBe("translateX(-88px)");
  expect(onTick).not.toHaveBeenCalled();
});

test("a tap on the line, or its box, puts it in the trolley", async () => {
  const user = userEvent.setup();
  const { onTick } = await mount();
  await user.click(screen.getByText("Batteries"));
  expect(onTick).toHaveBeenLastCalledWith(uuid("99999999", 4), true);
  await user.click(screen.getByRole("checkbox", { name: "Chicken" }));
  expect(onTick).toHaveBeenLastCalledWith(uuid("99999999", 3), true);
  expect(inAisles()).toEqual(["Butter", "Lemons"]);
});

test("the trolley bar opens a sheet of what is in it; a tap takes a line back out, and the last one out closes it", async () => {
  const user = userEvent.setup();
  const { onTick } = await mount();
  await user.click(screen.getByRole("checkbox", { name: "Lemons" }));
  await user.click(screen.getByRole("button", { name: /2 in the trolley/ }));

  const sheet = screen.getByRole("dialog", { name: "In the trolley" });
  expect(
    within(sheet)
      .getAllByRole("checkbox")
      .map((box) => [box.getAttribute("aria-label"), box.getAttribute("aria-checked")])
  ).toEqual([
    ["Lemons", "true"],
    ["Milk", "true"],
  ]);

  await user.click(within(sheet).getByText("Lemons"));
  expect(onTick).toHaveBeenLastCalledWith(uuid("99999999", 2), false);
  expect(within(sheet).queryByRole("checkbox", { name: "Lemons" })).toBeNull();
  expect(within(sheet).getByText("In the trolley · 1")).toBeInTheDocument();

  await user.click(within(sheet).getByRole("checkbox", { name: "Milk" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: /in the trolley/ })).toBeNull();
});

test("Clear the trolley asks first, then clears it", async () => {
  const user = userEvent.setup();
  const { onClearTicked } = await mount();
  await user.click(screen.getByRole("button", { name: /1 in the trolley/ }));
  await user.click(screen.getByRole("button", { name: "Clear the trolley" }));
  expect(onClearTicked).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
  expect(onClearTicked).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: /in the trolley/ })).toBeNull();
});

test("offline, the trolley still opens, but clearing it is refused", async () => {
  const user = userEvent.setup();
  await mount({ offline: true });
  await user.click(screen.getByRole("button", { name: /1 in the trolley/ }));
  expect(screen.getByRole("button", { name: "Clear the trolley" })).toBeDisabled();
});
