import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ReorderList } from "../../../src/components/ui/ReorderList";
import { TOUCH_DELAY_MS } from "../../../src/components/ui/useReorderDrag";
import { moveItem } from "../../../src/lib/lists";
import { dropIndex, rectContains, type Span } from "../../../src/lib/ui/reorder";

/** The opening tag of the control carrying `label`. */
function tagWithLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${label}"[^>]*>`));
  if (!match) throw new Error(`no control labelled ${label}`);
  return match[0];
}

describe("moveItem", () => {
  const items = ["a", "b", "c", "d"];

  test("moves down and up", () => {
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c", "d"]);
    expect(moveItem(items, 3, 2)).toEqual(["a", "b", "d", "c"]);
    expect(moveItem(items, 0, 3)).toEqual(["b", "c", "d", "a"]);
  });

  test("returns a copy, never the same array", () => {
    const same = moveItem(items, 1, 1);
    expect(same).toEqual(items);
    expect(same).not.toBe(items);
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  test("ignores out-of-range indices", () => {
    expect(moveItem(items, -1, 0)).toEqual(items);
    expect(moveItem(items, 0, 4)).toEqual(items);
    expect(moveItem(items, 4, 0)).toEqual(items);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

const rows = [
  { id: "x", text: "Flour" },
  { id: "y", text: "Sugar" },
  { id: "z", text: "Eggs" },
];

describe("ReorderList", () => {
  test("renders every row with up and down buttons, ends disabled", () => {
    const html = renderToString(
      <ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} renderItem={(r) => <span>{r.text}</span>} itemName="ingredient" />
    );
    expect(html).toContain("Flour");
    expect(html).toContain("Sugar");
    expect(html).toContain("Eggs");
    expect(html.match(/aria-label="Move ingredient \d up"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Move ingredient \d down"/g)).toHaveLength(3);
    expect(tagWithLabel(html, "Move ingredient 1 up")).toContain('disabled=""');
    expect(tagWithLabel(html, "Move ingredient 1 down")).not.toContain('disabled=""');
    expect(tagWithLabel(html, "Move ingredient 2 up")).not.toContain('disabled=""');
    expect(tagWithLabel(html, "Move ingredient 2 down")).not.toContain('disabled=""');
    expect(tagWithLabel(html, "Move ingredient 3 down")).toContain('disabled=""');
    expect(tagWithLabel(html, "Move ingredient 3 up")).not.toContain('disabled=""');
    expect(html).not.toContain("Remove");
  });

  test("a single row has both buttons disabled", () => {
    const html = renderToString(<ReorderList items={rows.slice(0, 1)} keyOf={(r) => r.id} onReorder={() => {}} renderItem={(r) => r.text} />);
    expect(tagWithLabel(html, "Move item 1 up")).toContain('disabled=""');
    expect(tagWithLabel(html, "Move item 1 down")).toContain('disabled=""');
  });

  test("renders a remove button per row only when onRemove is given", () => {
    const html = renderToString(
      <ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} onRemove={() => {}} renderItem={(r) => r.text} itemName="step" />
    );
    expect(html.match(/aria-label="Remove step \d"/g)).toHaveLength(3);
  });
});

/** Rows of `height` stacked from `top`, the shape a list of equal rows has. */
function stack(count: number, height = 40, top = 100): Span[] {
  return Array.from({ length: count }, (_, i) => ({ top: top + i * height, bottom: top + (i + 1) * height }));
}

describe("dropIndex", () => {
  // Four 40px rows from y=100: midpoints at 120, 160, 200, 240.
  const spans = stack(4);

  test("a row stays put until the pointer crosses a neighbour's midpoint", () => {
    expect(dropIndex(spans, 100, 0)).toBe(0);
    expect(dropIndex(spans, 159, 0)).toBe(0);
    expect(dropIndex(spans, 161, 0)).toBe(1);
    expect(dropIndex(spans, 201, 0)).toBe(2);
    expect(dropIndex(spans, 260, 0)).toBe(3);
  });

  test("dragging up crosses midpoints the other way", () => {
    expect(dropIndex(spans, 260, 3)).toBe(3);
    expect(dropIndex(spans, 199, 3)).toBe(2);
    expect(dropIndex(spans, 119, 3)).toBe(0);
    expect(dropIndex(spans, 0, 3)).toBe(0);
  });

  test("never leaves the list", () => {
    expect(dropIndex(spans, -5000, 2)).toBe(0);
    expect(dropIndex(spans, 5000, 1)).toBe(3);
  });

  test("uneven row heights use each row's own midpoint", () => {
    // A tall second row: 100-140, 140-340, 340-380. Midpoints 120, 240, 360.
    const uneven: Span[] = [
      { top: 100, bottom: 140 },
      { top: 140, bottom: 340 },
      { top: 340, bottom: 380 },
    ];
    expect(dropIndex(uneven, 239, 0)).toBe(0);
    expect(dropIndex(uneven, 241, 0)).toBe(1);
  });

  test("without a source index it is an insertion point, 0 to length", () => {
    expect(dropIndex(spans, 0, null)).toBe(0);
    expect(dropIndex(spans, 119, null)).toBe(0);
    expect(dropIndex(spans, 121, null)).toBe(1);
    expect(dropIndex(spans, 201, null)).toBe(3);
    expect(dropIndex(spans, 5000, null)).toBe(4);
    expect(dropIndex([], 5000, null)).toBe(0);
    expect(dropIndex([], 5000)).toBe(0);
  });

  test("an empty or out-of-range same-list drag clamps instead of throwing", () => {
    expect(dropIndex([], 120, 0)).toBe(0);
    expect(dropIndex(spans, 120, -1)).toBe(0);
    expect(dropIndex(spans, 120, 9)).toBe(3);
  });

  test("a single row has nowhere to go", () => {
    expect(dropIndex(stack(1), 0, 0)).toBe(0);
    expect(dropIndex(stack(1), 5000, 0)).toBe(0);
  });
});

describe("rectContains", () => {
  const box = { left: 10, right: 110, top: 20, bottom: 220 };

  test("inside, on the edge, and outside", () => {
    expect(rectContains(box, 50, 100)).toBe(true);
    expect(rectContains(box, 10, 20)).toBe(true);
    expect(rectContains(box, 110, 220)).toBe(true);
    expect(rectContains(box, 9, 100)).toBe(false);
    expect(rectContains(box, 50, 221)).toBe(false);
  });
});

describe("ReorderList drag handles", () => {
  test("every row grows a handle, kept out of the tab order", () => {
    const html = renderToString(<ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} renderItem={(r) => r.text} itemName="ingredient" />);
    expect(html.match(/aria-label="Drag ingredient \d"/g)).toHaveLength(3);
    expect(tagWithLabel(html, "Drag ingredient 2")).toContain('tabindex="-1"');
    // The handle must not eat a touch-scroll gesture by accident, so it owns its own touch-action.
    expect(tagWithLabel(html, "Drag ingredient 2")).toContain("touch-none");
    // Up/down and "move to" stay: drag is an addition, not a replacement.
    expect(html.match(/aria-label="Move ingredient \d up"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Move ingredient \d down"/g)).toHaveLength(3);
  });

  test("the group id reaches the list element so sibling lists can find it", () => {
    const html = renderToString(
      <ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} renderItem={(r) => r.text} group="ingredients" listKey="0" onMoveOut={() => {}} />
    );
    expect(html).toContain('data-reorder-group="ingredients"');
    expect(html.match(/data-index="\d"/g)).toHaveLength(3);
  });

  test("the touch delay is the 250 ms the plan asks for", () => {
    expect(TOUCH_DELAY_MS).toBe(250);
  });
});
