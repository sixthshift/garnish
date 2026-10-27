// A shopping row with no expanding part (decisions.md row 187): its text
// ticks it, its dishes link to their recipes, and it is removed by the trash
// with a mouse or by a swipe left on a touch screen.
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { foodSchema, unitSchema } from "../../../src/domain/reference";
import { mealsOf, type ShoppingItem, shoppingItemSchema } from "../../../src/domain/shopping";
import { DELETE_WIDTH, ShoppingRow, swipeOffset, swipeSettle } from "../../../src/routes/shopping/components/ShoppingRow";
import { renderInRouter } from "../../helpers/dom";

const stamp = "2026-01-01T00:00:00.000Z";
const gram = unitSchema.parse({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "gram", abbreviation: "g", useAbbreviation: true });
const butter = foodSchema.parse({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "butter" });
const source = (n: number, fields: Record<string, unknown>) => ({ id: `5a5a5a5a-5a5a-4a5a-8a5a-${String(n).padStart(12, "0")}`, ...fields });
const line: ShoppingItem = shoppingItemSchema.parse({
  id: "99999999-9999-4999-8999-000000000001",
  position: 1,
  createdAt: stamp,
  updatedAt: stamp,
  quantity: 350,
  unit: gram,
  food: butter,
  sources: [
    source(1, {
      recipeId: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
      recipeSlug: "lemon-tart",
      recipeName: "Lemon tart",
      planDate: "2026-10-26",
      quantity: 200,
      unit: gram,
    }),
    source(2, { recipeName: "Old soup", quantity: 150, unit: gram }),
  ],
});

async function mount() {
  const onTick = vi.fn();
  const onRemove = vi.fn();
  await renderInRouter(
    <ul>
      <ShoppingRow item={line} meals={mealsOf(line)} onTick={onTick} onRemove={onRemove} busy={false} />
    </ul>
  );
  return { onTick, onRemove, body: screen.getByTestId("shopping-row-body") };
}

describe("swipe", () => {
  test("a drag is held between closed and open, and a release rests at whichever is nearer", () => {
    expect(swipeOffset(0, 30)).toBe(0);
    expect(swipeOffset(0, -30)).toBe(-30);
    expect(swipeOffset(0, -500)).toBe(-DELETE_WIDTH);
    expect(swipeOffset(-DELETE_WIDTH, 30)).toBe(-DELETE_WIDTH + 30);
    expect(swipeSettle(-30)).toBe(0);
    expect(swipeSettle(-60)).toBe(-DELETE_WIDTH);
  });
});

test("tapping the line's text ticks it", async () => {
  const user = userEvent.setup();
  const { onTick } = await mount();
  await user.click(screen.getByText("350 g butter"));
  expect(onTick).toHaveBeenCalledWith(line.id, true);
});

test("each dish links to its recipe with its share; a dish whose recipe is gone is plain text", async () => {
  await mount();
  const link = screen.getByRole("link", { name: "Lemon tart Mon 200 g" });
  expect(link.getAttribute("href")).toBe("/recipes/lemon-tart");
  expect(screen.queryByRole("link", { name: /Old soup/ })).toBeNull();
  expect(screen.getByTestId("shopping-meals").textContent).toContain("Old soup 150 g");
});

test("the trash removes the line", async () => {
  const user = userEvent.setup();
  const { onRemove } = await mount();
  await user.click(screen.getByTestId("shopping-remove"));
  expect(onRemove).toHaveBeenCalledWith(line.id);
});

test("a touch swipe left slides the row open onto Delete, and does not tick it", async () => {
  const user = userEvent.setup();
  const { onTick, onRemove, body } = await mount();
  fireEvent.pointerDown(body, { pointerType: "touch", clientX: 200, clientY: 10 });
  fireEvent.pointerMove(body, { pointerType: "touch", clientX: 150, clientY: 12 });
  fireEvent.pointerMove(body, { pointerType: "touch", clientX: 100, clientY: 12 });
  fireEvent.pointerUp(body, { pointerType: "touch", clientX: 100, clientY: 12 });
  fireEvent.click(screen.getByText("350 g butter"));
  expect(onTick).not.toHaveBeenCalled();
  expect(body.style.transform).toBe(`translateX(${-DELETE_WIDTH}px)`);

  await user.click(screen.getByText("Delete"));
  expect(onRemove).toHaveBeenCalledWith(line.id);
});

test("a drag down is the page's scroll, not a swipe", async () => {
  const { body } = await mount();
  fireEvent.pointerDown(body, { pointerType: "touch", clientX: 200, clientY: 10 });
  fireEvent.pointerMove(body, { pointerType: "touch", clientX: 190, clientY: 80 });
  fireEvent.pointerUp(body, { pointerType: "touch", clientX: 190, clientY: 80 });
  expect(body.style.transform).toBe("translateX(0px)");
});
