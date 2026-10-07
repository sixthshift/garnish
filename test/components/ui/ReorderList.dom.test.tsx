// ReorderList's buttons and its drag. The drag is the reason this project
// wanted a DOM at all: it is pointer events, a document-level move listener
// and a drop target read out of the live layout, none of which a string can
// show. The node suite still covers what the list renders.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ReorderList } from "../../../src/components/ui/ReorderList";

type Row = { id: string; text: string };
const rows: Row[] = [
  { id: "a", text: "Onion" },
  { id: "b", text: "Garlic" },
  { id: "c", text: "Celery" },
];

/** The list with `onReorder` a spy, rows named so the buttons read "Move ingredient 2 up". */
function renderList(onRemove?: (item: Row, index: number) => void) {
  const onReorder = vi.fn();
  render(
    <ReorderList
      items={rows}
      keyOf={(row) => row.id}
      onReorder={onReorder}
      renderItem={(row) => <span>{row.text}</span>}
      itemName="ingredient"
      {...(onRemove === undefined ? {} : { onRemove })}
    />
  );
  return { onReorder };
}

test("the up and down buttons move a row, and the ends cannot go past themselves", async () => {
  const user = userEvent.setup();
  const { onReorder } = renderList();

  await user.click(screen.getByRole("button", { name: "Move ingredient 2 up" }));
  expect(onReorder).toHaveBeenCalledWith([rows[1], rows[0], rows[2]]);

  onReorder.mockClear();
  await user.click(screen.getByRole("button", { name: "Move ingredient 1 down" }));
  expect(onReorder).toHaveBeenCalledWith([rows[1], rows[0], rows[2]]);

  expect(screen.getByRole("button", { name: "Move ingredient 1 up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move ingredient 3 down" })).toBeDisabled();
});

test("the remove button reports the row it sits on, and is absent without a handler", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn();
  renderList(onRemove);

  await user.click(screen.getByRole("button", { name: "Remove ingredient 3" }));
  expect(onRemove).toHaveBeenCalledWith(rows[2], 2);
});

test("dragging a row's handle onto another row reorders to where it was dropped", async () => {
  const { onReorder } = renderList();
  const handles = screen.getAllByRole("button", { name: /drag ingredient/i });
  const items = screen.getAllByRole("listitem");

  // Each row is 40px tall and stacked, so a drop at y=110 is past the third row's midpoint.
  let top = 0;
  for (const item of items) {
    const at = top;
    item.getBoundingClientRect = () => ({ top: at, bottom: at + 40, height: 40, left: 0, right: 100, width: 100, x: 0, y: at, toJSON: () => ({}) }) as DOMRect;
    top += 40;
  }

  // Every handler is a prop on the handle: a live drag reaches it through
  // pointer capture, which is why the move and the up go there too.
  const handle = handles[0]!;
  handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientY: 10, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientY: 110, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientY: 110, pointerId: 1 }));

  expect(onReorder).toHaveBeenCalledWith([rows[1], rows[2], rows[0]]);
});

test("a drag that never moves changes nothing", () => {
  const { onReorder } = renderList();
  const handle = screen.getAllByRole("button", { name: /drag ingredient/i })[0]!;

  handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientY: 10, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientY: 10, pointerId: 1 }));

  expect(onReorder).not.toHaveBeenCalled();
});

test("a narrow list's ⋯ menu moves and removes the row it sits on", async () => {
  const user = userEvent.setup();
  const onReorder = vi.fn();
  const onRemove = vi.fn();
  render(
    <ReorderList
      items={rows}
      keyOf={(row) => row.id}
      onReorder={onReorder}
      onRemove={onRemove}
      renderItem={(row) => <span>{row.text}</span>}
      itemName="ingredient"
      narrow="menu"
    />
  );

  await user.click(screen.getByRole("button", { name: "Reorder ingredient 2" }));
  await user.click(screen.getByRole("menuitem", { name: "Move up" }));
  expect(onReorder).toHaveBeenCalledWith([rows[1], rows[0], rows[2]]);

  await user.click(screen.getByRole("button", { name: "Reorder ingredient 3" }));
  expect(screen.getByRole("menuitem", { name: "Move down" })).toBeDisabled();
  await user.click(screen.getByRole("menuitem", { name: "Remove" }));
  expect(onRemove).toHaveBeenCalledWith(rows[2], 2);
});

test("a row placing its own controls gets the handle and the moves, absent at the ends", async () => {
  const user = userEvent.setup();
  const onReorder = vi.fn();
  render(
    <ReorderList
      items={rows}
      keyOf={(row) => row.id}
      onReorder={onReorder}
      itemName="step"
      narrow="row"
      renderItem={(row, _, { handle, moveUp, moveDown }) => (
        <div>
          {handle}
          <span>{row.text}</span>
          {moveUp && (
            <button type="button" onClick={moveUp}>
              Up {row.text}
            </button>
          )}
          {moveDown === undefined && <span>last</span>}
        </div>
      )}
    />
  );

  // The list draws no handle of its own: the one each row placed is the only one.
  expect(screen.getAllByRole("button", { name: /drag step/i })).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Up Onion" })).toBeNull();
  expect(screen.getAllByText("last")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Up Celery" }));
  expect(onReorder).toHaveBeenCalledWith([rows[0], rows[2], rows[1]]);
});
