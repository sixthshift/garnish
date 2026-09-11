// The bulk-add sheet's stateless fields (M13.4): direct calls drive its three
// buttons the way the field-level tests in IngredientsEditor.test.tsx drive
// `IngredientFields`, since `BulkAddFields` has no hooks of its own. The
// sheet itself (which does hold state) only gets a render test, the same
// split the ingredient row's phone sheet uses.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BulkAddFields, BulkAddSheet, BulkReviewList } from "../../../src/components/ui/BulkAddSheet";
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

describe("BulkReviewList", () => {
  const review = {
    rows: (lines: string[]) => lines,
    keyOf: (row: string) => row,
    renderRow: (row: string) => <span>{row}</span>,
    confirm: () => {},
  };

  test("renders one block per row, through the caller's renderRow, and says nothing is created yet", () => {
    const html = renderToString(<BulkReviewList itemName="ingredient" rows={["Salt", "Pepper"]} review={review} onRowsChange={() => {}} />);
    expect(html).toContain("2 ingredients to review");
    expect(html).toContain("Nothing is created until you press Add.");
    expect(html).toContain("<span>Salt</span>");
    expect(html).toContain("<span>Pepper</span>");
  });

  test("one row is singular", () => {
    expect(renderToString(<BulkReviewList itemName="ingredient" rows={["Salt"]} review={review} onRowsChange={() => {}} />)).toContain("1 ingredient to review");
  });

  test("a row's onChange replaces that row and leaves the others alone", () => {
    let next: string[] | null = null;
    const tree = BulkReviewList({
      itemName: "ingredient",
      rows: ["Salt", "Pepper"],
      review: { ...review, renderRow: (row: string, index: number, onChange: (n: string) => void) => <button type="button" onClick={() => onChange(`${row}!`)}>{`row ${index}`}</button> },
      onRowsChange: (rows) => { next = rows; },
    });
    elementWithChildren(tree, "row 1").props.onClick();
    expect(next).toEqual(["Salt", "Pepper!"]);
  });
});

describe("BulkAddSheet with a review stage", () => {
  test("closed, or open before its mount effect has run, renders nothing", () => {
    const review = { rows: (lines: string[]) => lines, keyOf: (row: string) => row, renderRow: (row: string) => <span>{row}</span>, confirm: () => {} };
    expect(renderToString(<BulkAddSheet<string> open={false} onOpenChange={() => {}} itemName="ingredient" review={review} />)).toBe("");
    expect(renderToString(<BulkAddSheet<string> open onOpenChange={() => {}} itemName="ingredient" review={review} />)).toBe("");
  });
});
