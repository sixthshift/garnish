import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ReorderList, moveItem } from "../../../src/components/ui/ReorderList";

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
      <ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} renderItem={(r) => <span>{r.text}</span>} itemName="ingredient" />,
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
      <ReorderList items={rows} keyOf={(r) => r.id} onReorder={() => {}} onRemove={() => {}} renderItem={(r) => r.text} itemName="step" />,
    );
    expect(html.match(/aria-label="Remove step \d"/g)).toHaveLength(3);
  });
});
