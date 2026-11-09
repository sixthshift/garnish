// The Style space's wait: the pot at a boil over where the run has got to.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { StyleWait } from "../../../../../src/domain/recipes/components/style/StyleWait";

describe("StyleWait", () => {
  test("reading the guide first, with the rewrite to come counting the recipe's steps", () => {
    const html = renderToString(<StyleWait stage="rules" startedAt={Date.now()} steps={4} />);
    expect(html).toContain("Reading your house style…");
    expect(html).toMatch(/data-state="now"[^>]*>.*Reading your house style/);
    expect(html).toMatch(/data-state="next"[^>]*>.*Rewriting 4 steps/);
  });

  test("then rewriting, the guide ticked, the pot at a boil throughout, and the space's actions beside it", () => {
    const html = renderToString(<StyleWait stage="rewrite" startedAt={Date.now()} steps={1} actions={<button type="button">Save as written</button>} />);
    expect(html).toContain("Rewriting in your house style…");
    expect(html).toMatch(/data-state="done"[^>]*>.*Reading your house style/);
    expect(html).toContain("Rewriting 1 step");
    expect(html).toContain('data-boil="hard"');
    expect(html).toContain("Save as written");
  });
});
