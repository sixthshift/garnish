// The bulk-add sheet's stateless fields (M13.4): direct calls drive its three
// buttons the way the field-level tests in IngredientsEditor.test.tsx drive
// `IngredientFields`, since `BulkAddFields` has no hooks of its own. The
// sheet itself (which does hold state) only gets a render test, the same
// split the ingredient row's phone sheet uses.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BulkAddFields, BulkAddSheet } from "../../../src/components/ui/BulkAddSheet";
import { splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../../src/domain/bulkText";

/** The first element in `node` whose `children` prop is exactly `text`, without rendering it. */
function elementWithChildren(node: ReactNode, text: string): ReactElement<Record<string, any>> {
  const found = search(node);
  if (!found) throw new Error(`no element with children ${JSON.stringify(text)}`);
  return found;

  function search(current: ReactNode): ReactElement<Record<string, any>> | null {
    if (Array.isArray(current)) {
      for (const child of current) {
        const hit = search(child as ReactNode);
        if (hit) return hit;
      }
      return null;
    }
    if (!isValidElement(current)) return null;
    const props = current.props as Record<string, unknown>;
    if (props.children === text) return current as ReactElement<Record<string, any>>;
    return search(props.children as ReactNode);
  }
}

describe("BulkAddFields", () => {
  test("renders the textarea holding the current text and the three transform buttons", () => {
    const html = renderToString(<BulkAddFields itemName="ingredient" text={"Salt\nPepper"} onTextChange={() => {}} />);
    expect(html).toContain('aria-label="Bulk ingredient text"');
    expect(html).toContain(">Salt\nPepper</textarea>");
    expect(html).toContain(">Trim whitespace<");
    expect(html).toContain(">Strip leading numbers<");
    expect(html).toContain(">Split on blank lines<");
    expect(html).toContain("One ingredient per line");
  });

  test("disabled disables the textarea and all three buttons", () => {
    const html = renderToString(<BulkAddFields itemName="step" text="" onTextChange={() => {}} disabled />);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  test("Trim whitespace calls onTextChange with trimLines(text)", () => {
    const text = "  Salt  \nPepper  ";
    let next: string | null = null;
    const tree = BulkAddFields({ itemName: "ingredient", text, onTextChange: (t) => { next = t; } });
    elementWithChildren(tree, "Trim whitespace").props.onClick();
    expect(next).toBe(trimLines(text));
    expect(next).toBe("Salt\nPepper");
  });

  test("Strip leading numbers calls onTextChange with stripLeadingNumbers(text)", () => {
    const text = "1. Chop onions\n2) Dice garlic";
    let next: string | null = null;
    const tree = BulkAddFields({ itemName: "step", text, onTextChange: (t) => { next = t; } });
    elementWithChildren(tree, "Strip leading numbers").props.onClick();
    expect(next).toBe(stripLeadingNumbers(text));
    expect(next).toBe("Chop onions\nDice garlic");
  });

  test("Split on blank lines calls onTextChange with splitOnBlankLines(text)", () => {
    const text = "Chop onions.\n\nDice garlic and\nset aside.";
    let next: string | null = null;
    const tree = BulkAddFields({ itemName: "step", text, onTextChange: (t) => { next = t; } });
    elementWithChildren(tree, "Split on blank lines").props.onClick();
    expect(next).toBe(splitOnBlankLines(text));
    expect(next).toBe("Chop onions.\nDice garlic and set aside.");
  });
});

describe("BulkAddSheet", () => {
  // The design system's Sheet mounts its content by calling `show()` from a
  // `useEffect`, so `open` alone renders nothing under `renderToString` (no
  // effects run); this matches how the ingredient row's phone sheet is
  // tested — only ever asserted closed, with its fields covered directly.
  test("closed, or open before its mount effect has run, renders nothing", () => {
    expect(renderToString(<BulkAddSheet open={false} onOpenChange={() => {}} itemName="ingredient" onAdd={() => {}} />)).toBe("");
    expect(renderToString(<BulkAddSheet open onOpenChange={() => {}} itemName="ingredient" onAdd={() => {}} />)).toBe("");
  });
});
