// The bulk-add sheet's stateless fields (M13.4): direct calls drive its three
// buttons the way the field-level tests in IngredientsEditor.test.tsx drive
// `IngredientFields`, since `BulkAddFields` has no hooks of its own. The
// sheet itself (which does hold state) only gets a render test, the same
// split the ingredient row's phone sheet uses.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BulkAddFields, BulkAddSheet, BulkInlinePanel, BulkReviewList } from "../../../src/components/ui/BulkAddSheet";
import { paragraphs, splitOnBlankLines, stripLeadingNumbers, trimLines } from "../../../src/domain/ingredient/bulkText";

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

// The inline panel (M27.2): the same two stages without the sheet, stateless
// so both are rendered and driven directly.
describe("BulkInlinePanel", () => {
  const review = { rows: (lines: string[]) => lines, keyOf: (row: string) => row, renderRow: (row: string) => <span>{row}</span>, confirm: () => {} };
  const props = { itemName: "ingredient", review, onTextChange: () => {}, onRowsChange: () => {}, onAdvance: () => {}, onBack: () => {} };

  test("with no rows yet it is a textarea, one ingredient per line, and Add", () => {
    const html = renderToString(<BulkInlinePanel {...props} text="Salt" rows={null} />);
    expect(html).toContain('aria-label="New ingredients"');
    expect(html).toContain('placeholder="One ingredient per line"');
    expect(html).toContain(">Salt</textarea>");
    expect(html).toContain(">Add<");
    expect(html).not.toContain(">Confirm<");
  });

  test("Add is disabled while the text holds no lines, and enabled once it does", () => {
    expect(renderToString(<BulkInlinePanel {...props} text="   " rows={null} />)).toMatch(/<button[^>]*disabled=""[^>]*>Add</);
    expect(renderToString(<BulkInlinePanel {...props} text="Salt" rows={null} />)).not.toMatch(/<button[^>]*disabled=""[^>]*>Add</);
  });

  test("with rows the textarea is gone and the review rows show with Back and Confirm", () => {
    const html = renderToString(<BulkInlinePanel {...props} text="Salt" rows={["Salt", "Pepper"]} />);
    expect(html).not.toContain("<textarea");
    expect(html).toContain("2 ingredients to review. Nothing is created until you press Confirm.");
    expect(html).toContain("<span>Salt</span>");
    expect(html).toContain(">Back<");
    expect(html).toContain(">Confirm<");
  });

  test("an error from a failed confirm shows above the buttons", () => {
    const html = renderToString(<BulkInlinePanel {...props} text="Salt" rows={["Salt"]} error="Could not add the ingredients" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not add the ingredients");
  });

  test("busy disables Back and Confirm", () => {
    const html = renderToString(<BulkInlinePanel {...props} text="Salt" rows={["Salt"]} busy />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Back</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm</);
  });

  test("Add and Confirm both call onAdvance; Back calls onBack", () => {
    let advanced = 0;
    let backed = 0;
    const wired = { ...props, onAdvance: () => { advanced += 1; }, onBack: () => { backed += 1; } };
    elementWithChildren(BulkInlinePanel({ ...wired, text: "Salt", rows: null }), "Add").props.onClick();
    const reviewing = BulkInlinePanel({ ...wired, text: "Salt", rows: ["Salt"] });
    elementWithChildren(reviewing, "Confirm").props.onClick();
    elementWithChildren(reviewing, "Back").props.onClick();
    expect(advanced).toBe(2);
    expect(backed).toBe(1);
  });
});

// The plain (no-review) case, M27.3: the steps side, where "Add" commits the
// split lines straight away rather than opening a review stage.
describe("BulkInlinePanel with no review", () => {
  const plainProps = { itemName: "step", text: "", rows: null, onTextChange: () => {}, onRowsChange: () => {}, onAdvance: () => {}, onBack: () => {} };

  test("with no review it is always the textarea, whatever rows holds", () => {
    const html = renderToString(<BulkInlinePanel {...plainProps} text="Mix." rows={null} />);
    expect(html).toContain('aria-label="New steps"');
    expect(html).toContain("One step per line");
    expect(html).toContain(">Add<");
    expect(html).not.toContain(">Confirm<");
    expect(html).not.toContain("to review");
  });

  test("a caller placeholder overrides the default", () => {
    const html = renderToString(<BulkInlinePanel {...plainProps} placeholder="The method, a blank line between steps" />);
    expect(html).toContain("The method, a blank line between steps");
    expect(html).not.toContain("One step per line");
  });

  test("Add is disabled or enabled by the caller's splitLines, not always bulkLines", () => {
    // One line by `bulkLines`, but two paragraphs, so the default (bulkLines) and a paragraph split disagree.
    const text = "Mix the dry ingredients\nand the wet.\n\nBake it.";
    const withDefault = renderToString(<BulkInlinePanel {...plainProps} text={text} />);
    expect(withDefault).not.toMatch(/<button[^>]*disabled=""[^>]*>Add</); // three bulkLines lines, none blank

    const empty = renderToString(<BulkInlinePanel {...plainProps} text={"   \n\n  "} splitLines={paragraphs} />);
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Add</); // no paragraphs in blank text

    const withParagraphs = renderToString(<BulkInlinePanel {...plainProps} text={text} splitLines={paragraphs} />);
    expect(withParagraphs).not.toMatch(/<button[^>]*disabled=""[^>]*>Add</);
  });

  test("Add calls onAdvance, same as the reviewed case", () => {
    let advanced = 0;
    const tree = BulkInlinePanel({ ...plainProps, text: "Mix.", onAdvance: () => { advanced += 1; } });
    elementWithChildren(tree, "Add").props.onClick();
    expect(advanced).toBe(1);
  });
});
