// Shopping on a desktop is a walk round the shop (decisions.md row 207): the
// aisles across the width, a trolley that ticked lines move into, and the
// list's meals as a key that lights up their lines on hover and keeps them lit
// on a click.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { ShoppingListView } from "../../../../src/domain/shopping/components/ShoppingListView";
import { type ShoppingItem, shoppingItemSchema } from "../../../../src/domain/shopping/shopping";
import { renderInRouter } from "../../../helpers/dom";
import { atDesktop, resizeTo } from "../../../helpers/layout";

atDesktop();

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
function Harness({ onTick }: { onTick: (id: string, ticked: boolean) => void }) {
  const [items, setItems] = useState(list);
  return (
    <ShoppingListView
      items={items}
      onAdd={() => {}}
      onRemove={(id) => setItems((current) => current.filter((line) => line.id !== id))}
      onClearTicked={() => {}}
      onTick={(id, ticked) => {
        onTick(id, ticked);
        setItems((current) => current.map((line) => (line.id === id ? { ...line, ticked } : line)));
      }}
    />
  );
}

async function mount() {
  const onTick = vi.fn();
  await renderInRouter(<Harness onTick={onTick} />);
  return onTick;
}

/** The row a checkbox names, as the walk draws it. */
const rowOf = (name: string) => screen.getByRole("checkbox", { name }).closest("li")!;
const dimmed = (name: string) => rowOf(name).className.includes("opacity-30");

test("the header says how far along the shop is, and the meals key lists the list's dishes in day order with what each still wants", async () => {
  await mount();
  expect(screen.getByText("1 of 5")).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "In the trolley" })).toBeInTheDocument();
  // No Aisles/Meals toggle: the key does the meal view's job on a desktop.
  expect(screen.queryByRole("radio", { name: "Meals" })).toBeNull();
  const key = screen.getByRole("complementary", { name: "Meals" });
  expect(
    within(key)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
  ).toEqual(["Lemon tart, Mon: 2 to buy", "Roast chicken, Wed: 2 to buy"]);
});

test("pointing at a meal lights its lines and dims the rest; leaving it puts them back", async () => {
  const user = userEvent.setup();
  await mount();
  const tart = screen.getByRole("button", { name: "Lemon tart, Mon: 2 to buy" });

  await user.hover(tart);
  expect(dimmed("Butter")).toBe(false);
  expect(dimmed("Lemons")).toBe(false);
  expect(dimmed("Chicken")).toBe(true);
  expect(dimmed("Batteries")).toBe(true);

  await user.unhover(tart);
  expect(["Butter", "Lemons", "Chicken", "Batteries"].some(dimmed)).toBe(false);
});

test("clicking a meal keeps it lit past the pointer, and clicking it again lets it go", async () => {
  const user = userEvent.setup();
  await mount();
  const chicken = screen.getByRole("button", { name: "Roast chicken, Wed: 2 to buy" });

  await user.click(chicken);
  expect(chicken).toHaveAttribute("aria-pressed", "true");
  await user.unhover(chicken);
  // Moving over another meal while one is pinned changes nothing.
  await user.hover(screen.getByRole("button", { name: "Lemon tart, Mon: 2 to buy" }));
  expect(dimmed("Chicken")).toBe(false);
  expect(dimmed("Butter")).toBe(false);
  expect(dimmed("Lemons")).toBe(true);

  await user.click(chicken);
  expect(chicken).toHaveAttribute("aria-pressed", "false");
  await user.unhover(chicken);
  expect(["Butter", "Lemons", "Chicken", "Batteries"].some(dimmed)).toBe(false);
});

test("a pinned meal whose lines have all gone lights nothing, rather than dimming the whole list", async () => {
  const user = userEvent.setup();
  await mount();
  await user.click(screen.getByRole("button", { name: "Lemon tart, Mon: 2 to buy" }));
  expect(dimmed("Chicken")).toBe(true);

  await user.click(within(rowOf("Lemons")).getAllByRole("button", { name: "Remove Lemons" })[0]!);
  await user.click(within(rowOf("Butter")).getAllByRole("button", { name: "Remove Butter" })[0]!);
  expect(screen.queryByRole("button", { name: /^Lemon tart/ })).toBeNull();
  expect(["Chicken", "Batteries"].some(dimmed)).toBe(false);
});

test("a tick slides the line out of its aisle and into the trolley, and an untick there brings it back", async () => {
  const user = userEvent.setup();
  const onTick = await mount();
  const trolley = screen.getByRole("complementary", { name: "In the trolley" });
  expect(within(trolley).getByRole("checkbox", { name: "Milk" })).toBeChecked();

  await user.click(screen.getByRole("checkbox", { name: "Lemons" }));
  await waitFor(() => expect(onTick).toHaveBeenCalledWith(uuid("99999999", 2), true));
  expect(within(trolley).getByRole("checkbox", { name: "Lemons" })).toBeChecked();
  expect(within(screen.getByRole("region", { name: "Other" })).queryByRole("checkbox", { name: "Lemons" })).toBeNull();
  expect(screen.getByText("2 of 5")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lemon tart, Mon: 1 to buy" })).toBeInTheDocument();

  await user.click(within(trolley).getByRole("checkbox", { name: "Lemons" }));
  expect(onTick).toHaveBeenLastCalledWith(uuid("99999999", 2), false);
  expect(within(screen.getByRole("region", { name: "Other" })).getByRole("checkbox", { name: "Lemons" })).not.toBeChecked();
});

test("under about 1360px the trolley is a chip that opens it above the aisles", async () => {
  resizeTo(1200);
  const user = userEvent.setup();
  await mount();
  expect(screen.queryByRole("complementary", { name: "In the trolley" })).toBeNull();
  const chip = screen.getByRole("button", { name: "1 in the trolley" });
  expect(chip).toHaveAttribute("aria-expanded", "false");
  await user.click(chip);
  expect(within(screen.getByRole("complementary", { name: "In the trolley" })).getByRole("checkbox", { name: "Milk" })).toBeChecked();
});
