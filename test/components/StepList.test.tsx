// StepList / StepRow: markdown rendering through the safe subset, the HTML
// injection case as it reaches the DOM, and the done state (dimmed, collapsed,
// read back from ticks.ts).
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { Markdown } from "../../src/components/Markdown";
import { StepList } from "../../src/components/StepList";
import type { Step } from "../../src/domain/recipe";
import { setStepTicked, type StorageLike } from "../../src/lib/ticks";

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const STEP_ID = "33333333-3333-4333-8333-333333333333";

const step = (text: string, id = STEP_ID): Step => ({ id, text });

/** An in-memory sessionStorage, so useStepTick reads what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

function withStorage(storage: StorageLike) {
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

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

describe("StepList", () => {
  test("numbers each step and renders its markdown", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix the **dough**"), step("Rest it", "44444444-4444-4444-8444-444444444444")]} />);
    expect(html).toContain('aria-label="Steps"');
    expect(html).toMatch(/<strong[^>]*>dough<\/strong>/);
    expect(html).toContain("Step 1. ");
    expect(html).toContain("Step 2. ");
  });

  test("an unticked step is neither dimmed nor collapsed", () => {
    withStorage(fakeStorage());
    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).not.toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("line-clamp-1");
    expect(html).not.toContain("opacity-60");
  });

  test("a ticked step dims and collapses its text", () => {
    const storage = fakeStorage();
    setStepTicked(storage, RECIPE_ID, STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).toContain('data-ticked="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("opacity-60");
    expect(html).toContain("line-clamp-1");
    expect(html).toContain("Step 1. Done. ");
  });

  test("ticks are per recipe", () => {
    const storage = fakeStorage();
    setStepTicked(storage, "99999999-9999-4999-8999-999999999999", STEP_ID, true);
    withStorage(storage);

    const html = renderToString(<StepList recipeId={RECIPE_ID} steps={[step("Mix")]} />);
    expect(html).not.toContain('data-ticked="true"');
  });
});
