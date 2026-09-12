// Markdown's `decorate` prop (M26.2): a function applied to every literal
// text run, so a caller can splice inline elements — a TimerChip, in
// practice — into the middle of a paragraph or list item. The other Markdown
// render tests (blocks, inline emphasis, the HTML-injection guarantee) live
// in test/components/StepList.test.tsx, alongside the component that uses it
// without a decorator.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Markdown } from "../../src/components/Markdown";

/** Wraps every text run passed through it in a marker element, so the test can see exactly what the decorator was called with. */
function mark(text: string) {
  return <mark key={text}>{`[${text}]`}</mark>;
}

describe("Markdown decorate", () => {
  test("with no decorator, text renders as before", () => {
    const html = renderToString(<Markdown source="Rest for 20 minutes." />);
    expect(html).toBe('<div class="flex flex-col gap-2" data-testid="markdown"><p class="whitespace-pre-line">Rest for 20 minutes.</p></div>');
  });

  test("a decorator wraps a plain paragraph's text", () => {
    const html = renderToString(<Markdown source="Rest for 20 minutes." decorate={mark} />);
    expect(html).toContain("<mark>[Rest for 20 minutes.]</mark>");
  });

  test("a decorator reaches text nested inside bold and italics", () => {
    const html = renderToString(<Markdown source="Rest for **20 minutes**, then *serve*." decorate={mark} />);
    expect(html).toContain("<strong");
    expect(html).toContain("<mark>[20 minutes]</mark>");
    expect(html).toContain("<mark>[serve]</mark>");
    expect(html).toContain("<mark>[Rest for ]</mark>");
    expect(html).toContain("<mark>[, then ]</mark>");
    expect(html).toContain("<mark>[.]</mark>");
  });

  test("a decorator reaches every list item's text", () => {
    const html = renderToString(<Markdown source={"- salt\n- pepper"} decorate={mark} />);
    expect(html).toContain("<mark>[salt]</mark>");
    expect(html).toContain("<mark>[pepper]</mark>");
  });

  test("a decorator that returns the text unchanged renders the same as none", () => {
    const identity = (text: string) => text;
    const html = renderToString(<Markdown source="Rest for 20 minutes." decorate={identity} />);
    expect(html).toBe('<div class="flex flex-col gap-2" data-testid="markdown"><p class="whitespace-pre-line">Rest for 20 minutes.</p></div>');
  });

  test("blank source still renders nothing, decorator or not", () => {
    expect(renderToString(<Markdown source="   " decorate={mark} />)).toBe("");
  });
});
