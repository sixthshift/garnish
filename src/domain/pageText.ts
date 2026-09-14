// Readable text out of a page's raw HTML (M36.3), for the AI import rung
// (`aiImport.ts`) to read once a model is configured. A page is markup meant
// for a browser, not for a model, and the model has no use for the chrome
// around a recipe: the nav bar, the header, the cookie banner in the aside,
// the footer, a `<script>`'s payload. Stripped down to the words a reader
// would actually see, in roughly the order they read them, a page fits in far
// fewer tokens and stops confusing the model with navigation text that reads
// like a list of links.
//
// This is a small tag scanner, not a DOM: no parser dependency, and one that
// runs the same on the server as it would in a test. It walks the markup once
// with a regex over tag boundaries, keeping a stack of the tags being
// dropped so their content — and any tags nested inside them — never reaches
// the output, and turning every block element's boundary into a line break so
// the shape of the page (one line of content per row, one heading per line)
// survives even though the tags themselves do not. Headings come out prefixed
// `# `, the closest a plain-text rendering gets to marking a heading, because
// `aiPrompt`'s "a named section is a part" reads better with a line it can
// point at than with the heading's text sitting flush with the paragraph
// after it.
import { decodeEntities } from "./schemaRecipe";

/** The most text worth handing to a model. `aiImport.ts`'s `MAX_AI_TEXT` is this number: one cap, defined once. */
export const MAX_PAGE_TEXT = 40_000;

/** Tags whose content, and whatever markup is nested inside them, never reaches the output. */
const DROP_TAGS = new Set(["script", "style", "noscript", "template", "svg", "iframe", "form", "nav", "header", "footer", "aside"]);

/** Tags whose boundary ends a line: the common block-level elements, plus the void `br`/`hr`. */
const BLOCK_TAGS = new Set([
  "address", "article", "blockquote", "body", "br", "dd", "details", "dialog", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html",
  "li", "main", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "video",
]);

/** `h1` through `h6`: their own line, prefixed `# `. */
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** A tag's name and whether it opens, closes, or (for a void element) opens and closes at once. */
const TAG_PATTERN = /<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/**
 * The readable text of a page: `script`, `style`, `noscript`, `template`,
 * `svg`, `iframe`, `form`, `nav`, `header`, `footer`, `aside` and comments
 * dropped along with everything nested inside them; every other block
 * element's boundary ends a line; a heading comes out on its own line
 * prefixed `# `; entities decoded; runs of whitespace collapsed to one space
 * within a line, and blank lines dropped; the result capped at
 * `MAX_PAGE_TEXT`. Pure — regex and a small tag scanner, no DOM.
 */
export function readableText(html: string): string {
  // Comments, then whatever `<!...>` markup declarations are left — chiefly
  // `<!DOCTYPE html>`, which is not a tag `TAG_PATTERN` recognises and would
  // otherwise leak into the output as literal angle brackets.
  // `script` and `style` go first, as whole elements, because their bodies are
  // raw text the tag scanner must never look inside: a JS string holding
  // `'<svg …>'` for an icon, or a template literal of markup, would otherwise
  // push a drop tag with no closing partner and swallow the rest of the page.
  // Bare `</script>` is the only thing that ends a script body in a browser
  // too, so this matches what the page actually renders.
  const withoutComments = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<![^>]*>/g, "");

  let out = "";
  let lastIndex = 0;
  const dropStack: string[] = [];
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(withoutComments)) !== null) {
    const segment = withoutComments.slice(lastIndex, match.index);
    lastIndex = TAG_PATTERN.lastIndex;

    if (dropStack.length === 0 && segment !== "") out += segment;

    const whole = match[0];
    const name = match[1]!.toLowerCase();
    const isClosing = whole.startsWith("</");

    if (isClosing) {
      if (dropStack.length > 0) {
        // Pop back to the nearest matching open tag, not only the top: a
        // `<footer>` a theme never closes would otherwise sit on the stack
        // and drop everything after it. Anything above the match was left
        // unclosed by the page and is closed along with it.
        const open = dropStack.lastIndexOf(name);
        if (open !== -1) dropStack.length = open;
      } else if (BLOCK_TAGS.has(name)) {
        out += "\n";
      }
      continue;
    }

    if (DROP_TAGS.has(name)) {
      // A self-closed drop tag (rare — these tags are always written with a
      // body in practice) has nothing to skip; only push when there is a
      // closing tag out there to pop it again.
      if (!/\/>\s*$/.test(whole)) dropStack.push(name);
      continue;
    }
    if (dropStack.length > 0) continue;

    if (HEADING_TAGS.has(name)) out += "\n# ";
    else if (name === "li" || name === "br" || name === "hr") out += "\n";
  }
  if (dropStack.length === 0) out += withoutComments.slice(lastIndex);

  const lines = decodeEntities(out)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");

  const text = lines.join("\n");
  return text.length > MAX_PAGE_TEXT ? text.slice(0, MAX_PAGE_TEXT) : text;
}

/**
 * Whether a paste is a page's source rather than prose (M36.7). Someone who
 * hit a bot wall is told to view source, select all and copy, and what lands
 * in the box is then the same markup a successful fetch would have returned —
 * so it deserves the same treatment, rules first and the model over the
 * readable text, instead of being handed to the model as a wall of tags.
 *
 * Three marks, any one of which settles it: a doctype, an `<html` tag, or an
 * `ld+json` script. The last is the one that matters most, because a paste
 * that carries structured data is exactly the paste the rules can read, even
 * when the browser's view-source gave only a fragment with no doctype on it.
 * Wide rather than narrow on purpose: the cost of taking prose for markup is
 * one wasted rules pass that finds nothing and falls through to the model
 * anyway, while the cost of taking markup for prose is sending the model a
 * page of tags and losing the JSON-LD that was sitting right there. Pure.
 */
export function looksLikeHtml(text: string): boolean {
  return /<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text) || /<script[^>]*\bld\+json\b/i.test(text);
}
