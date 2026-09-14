// The safe markdown subset step text (and, later, note text) is written in.
// Pure: text in, a small block/inline tree out. No IO, no HTML string, no
// dependency — the tree is rendered by React (src/components/ui/Markdown.tsx), so
// every text node is escaped by React and there is no path by which raw HTML in
// a recipe can become markup. `<script>alert(1)</script>` in a step is text.
//
// The subset, and nothing else (decisions.md row 13's "copy Mealie" applies to
// the syntax, not to markdown-it's full feature set):
//   - paragraphs, separated by a blank line; single newlines inside one are
//     kept as line breaks, because cooks write steps that way;
//   - `- `, `* ` or `+ ` bullet lists, `1. ` / `1) ` numbered lists;
//   - `**bold**` / `__bold__` and `*italic*` / `_italic_`, nestable.
// Anything else — headings, links, images, code, block quotes, tables, HTML —
// is left alone as literal text rather than being stripped, so nothing a cook
// typed disappears from a recipe.

/** An inline run: literal text, or an emphasis wrapper around more inline runs. */
export type Inline = { type: "text"; value: string } | { type: "strong"; children: Inline[] } | { type: "em"; children: Inline[] };

/** A block: one paragraph, or one list of items (each item its own inline runs). */
export type Block = { type: "paragraph"; children: Inline[] } | { type: "list"; ordered: boolean; start: number; items: Inline[][] };

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;

/** The list marker on `line`, if it starts one. Pure. */
function listItem(line: string): { ordered: boolean; number: number; text: string } | undefined {
  const ordered = ORDERED.exec(line);
  if (ordered) return { ordered: true, number: Number(ordered[1]), text: ordered[2] ?? "" };
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, number: 0, text: bullet[1] ?? "" };
  return undefined;
}

/** True where `text` has a `**`/`__` delimiter at `index`. */
function isDouble(text: string, index: number, marker: string): boolean {
  return text.startsWith(marker + marker, index);
}

/**
 * Inline runs for one line of source: emphasis pairs resolved, everything else
 * literal. An unpaired `*` or `_` stays as the character it is. Pure.
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer !== "") out.push({ type: "text", value: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === "*" || char === "_") {
      const double = isDouble(text, i, char);
      const delimiter = double ? char + char : char;
      const from = i + delimiter.length;
      const close = closingIndex(text, delimiter, from);
      if (close !== -1) {
        flush();
        const children = parseInline(text.slice(from, close));
        out.push(double ? { type: "strong", children } : { type: "em", children });
        i = close + delimiter.length;
        continue;
      }
    }
    buffer += char;
    i += 1;
  }
  flush();
  return out;
}

/** How many copies of `text[index]` run consecutively from `index`. */
function runLength(text: string, index: number): number {
  const char = text[index];
  let end = index;
  while (end < text.length && text[end] === char) end += 1;
  return end - index;
}

/**
 * Where `delimiter` closes, searching from `from`; -1 when it never does or
 * would close on empty content (`****`). A single-character delimiter does not
 * match half of a doubled one, so `*a **b** c*` nests rather than mis-pairing;
 * a `**` closing against a longer run takes the run's last two characters, so
 * `**very *gently***` closes the italics before the bold.
 */
function closingIndex(text: string, delimiter: string, from: number): number {
  const single = delimiter.length === 1;
  for (let i = from; i < text.length; i += 1) {
    if (!text.startsWith(delimiter, i)) continue;
    const run = runLength(text, i);
    if (single && run > 1) {
      i += run - 1;
      continue;
    }
    const close = i + Math.max(0, run - delimiter.length);
    if (close <= from) {
      i += run - 1;
      continue;
    }
    return close;
  }
  return -1;
}

/**
 * Blocks for a whole step (or note) body. Blank lines separate blocks; a run of
 * list lines is one list, and the numbers on an ordered list only set where it
 * starts. Empty input, or input that is all whitespace, is no blocks. Pure.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | undefined;

  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const closeList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, start: list.start, items: list.items.map(parseInline) });
    list = undefined;
  };

  for (const line of lines) {
    if (line.trim() === "") {
      closeParagraph();
      closeList();
      continue;
    }
    const item = listItem(line);
    if (item) {
      closeParagraph();
      // A different marker kind starts a new list, as markdown-it does.
      if (list && list.ordered !== item.ordered) closeList();
      if (!list) list = { ordered: item.ordered, start: item.ordered ? item.number : 1, items: [] };
      list.items.push(item.text);
      continue;
    }
    closeList();
    paragraph.push(line.trimEnd());
  }
  closeParagraph();
  closeList();
  return blocks;
}

/** The rendered text of a tree, markers dropped: for aria labels, search and truncation. Pure. */
export function plainText(blocks: Block[]): string {
  const inline = (nodes: Inline[]): string => nodes.map((node) => (node.type === "text" ? node.value : inline(node.children))).join("");
  return blocks.map((block) => (block.type === "paragraph" ? inline(block.children) : block.items.map(inline).join("\n"))).join("\n\n");
}
