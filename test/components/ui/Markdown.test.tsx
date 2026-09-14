// Markdown: the safe subset (src/domain/markdown.ts) as React elements —
// blocks, inline emphasis, and the guarantee that anything HTML-shaped a cook
// typed reaches the DOM as the characters they typed. M29.1 removed the
// `decorate` prop with the timer chips that were spliced through it, so there
// is one rendering path and these are all of it.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Markdown } from "../../../src/components/ui/Markdown";

describe("Markdown", () => {
  test("bold, italics and a list become real elements", () => {
    const html = renderToString(<Markdown source={"Fold **gently** and *slowly*\n\n- salt\n- pepper"} />);
    expect(html).toMatch(/<strong[^>]*>gently<\/strong>/);
    expect(html).toContain("<em>slowly</em>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>salt</li>");
  });

  test("an ordered list keeps its start", () => {
    const html = renderToString(<Markdown source="3. simmer" />);
    expect(html).toMatch(/<ol[^>]*start="3"/);
  });

  test("a plain paragraph is exactly that", () => {
    const html = renderToString(<Markdown source="Rest for 20 minutes." />);
    expect(html).toBe('<div class="flex flex-col gap-2" data-testid="markdown"><p class="whitespace-pre-line">Rest for 20 minutes.</p></div>');
  });

  test("HTML in a step is escaped, never markup", () => {
    const html = renderToString(<Markdown source={'<script>alert("x")</script><b>no</b>'} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;no&lt;/b&gt;");
  });

  test("blank source renders nothing", () => {
    expect(renderToString(<Markdown source="   " />)).toBe("");
  });
});
