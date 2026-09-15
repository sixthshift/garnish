// The safe markdown subset: blocks, inline emphasis, and the guarantee that
// nothing HTML-shaped in a recipe ever becomes markup.
import { describe, expect, test } from "vitest";
import { parseInline, parseMarkdown, plainText } from "../../src/lib/markdown";

const text = (value: string) => ({ type: "text", value }) as const;

describe("parseInline", () => {
  test("plain text is one run", () => {
    expect(parseInline("Fold the batter")).toEqual([text("Fold the batter")]);
  });

  test("**bold** and __bold__", () => {
    expect(parseInline("Fold **gently**")).toEqual([text("Fold "), { type: "strong", children: [text("gently")] }]);
    expect(parseInline("__gently__")).toEqual([{ type: "strong", children: [text("gently")] }]);
  });

  test("*italic* and _italic_", () => {
    expect(parseInline("Fold *gently*")).toEqual([text("Fold "), { type: "em", children: [text("gently")] }]);
    expect(parseInline("_gently_")).toEqual([{ type: "em", children: [text("gently")] }]);
  });

  test("italics nest inside bold and vice versa", () => {
    expect(parseInline("**very *gently***")).toEqual([
      { type: "strong", children: [text("very "), { type: "em", children: [text("gently")] }] },
    ]);
    expect(parseInline("*a **b** c*")).toEqual([
      { type: "em", children: [text("a "), { type: "strong", children: [text("b")] }, text(" c")] },
    ]);
  });

  test("an unpaired marker stays a literal character", () => {
    expect(parseInline("2 * 3 cups")).toEqual([text("2 * 3 cups")]);
    expect(parseInline("**unclosed")).toEqual([text("**unclosed")]);
    expect(parseInline("snake_case")).toEqual([text("snake_case")]);
  });

  test("empty emphasis is left alone", () => {
    expect(parseInline("****")).toEqual([text("****")]);
  });
});

describe("parseMarkdown", () => {
  test("blank input is no blocks", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("  \n\n \n")).toEqual([]);
  });

  test("a blank line separates paragraphs; single newlines stay inside one", () => {
    expect(parseMarkdown("one\ntwo\n\nthree")).toEqual([
      { type: "paragraph", children: [text("one\ntwo")] },
      { type: "paragraph", children: [text("three")] },
    ]);
  });

  test("bullet lists with any of the three markers", () => {
    expect(parseMarkdown("- a\n* b\n+ c")).toEqual([
      { type: "list", ordered: false, start: 1, items: [[text("a")], [text("b")], [text("c")]] },
    ]);
  });

  test("ordered lists keep where they start", () => {
    expect(parseMarkdown("3. a\n4) b")).toEqual([{ type: "list", ordered: true, start: 3, items: [[text("a")], [text("b")]] }]);
  });

  test("a change of marker kind starts a new list", () => {
    const blocks = parseMarkdown("- a\n1. b");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true });
  });

  test("emphasis inside a list item is parsed", () => {
    expect(parseMarkdown("- **a**")).toEqual([{ type: "list", ordered: false, start: 1, items: [[{ type: "strong", children: [text("a")] }]] }]);
  });

  test("paragraph then list then paragraph", () => {
    const blocks = parseMarkdown("intro\n- a\n- b\noutro");
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "list", "paragraph"]);
  });

  test("carriage returns are normalised", () => {
    expect(parseMarkdown("a\r\n\r\nb").map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
  });

  test("HTML injection: tags are literal text, never a node type of their own", () => {
    const blocks = parseMarkdown('<script>alert("x")</script>\n\n<b onclick="x">bold?</b>');
    expect(blocks).toEqual([
      { type: "paragraph", children: [text('<script>alert("x")</script>')] },
      { type: "paragraph", children: [text('<b onclick="x">bold?</b>')] },
    ]);
    // Nothing in the tree is anything but text/strong/em, so no renderer can emit markup from it.
    expect(JSON.stringify(blocks)).not.toContain('"html"');
  });

  test("unsupported syntax is kept verbatim rather than dropped", () => {
    expect(parseMarkdown("# Heading\n\n[link](http://example.com)")).toEqual([
      { type: "paragraph", children: [text("# Heading")] },
      { type: "paragraph", children: [text("[link](http://example.com)")] },
    ]);
  });
});

describe("plainText", () => {
  test("markers dropped, blocks separated", () => {
    expect(plainText(parseMarkdown("Fold **gently**\n\n- a\n- b"))).toBe("Fold gently\n\na\nb");
  });

  test("nothing in, nothing out", () => {
    expect(plainText(parseMarkdown(""))).toBe("");
  });
});
