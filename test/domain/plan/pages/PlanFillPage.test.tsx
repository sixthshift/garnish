// Plan the week (decisions.md row 192), the route end to end: its loader
// against a temp DATA_DIR, the clock pinned so "today" is a known day.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addPlanEntry } from "../../../../src/api/rpc/plan";
import { createRecipe } from "../../../../src/api/rpc/recipes";
import { noFacets } from "../../../../src/domain/recipes/recipe";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/api/rpc/plan", local);
vi.mock("../../../../src/api/rpc/recipes", local);

const NEXT_MONDAY = "2026-09-21";

describe("/plan/fill", () => {
  useTempDataDir();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T10:00:00")); // a Saturday
  });
  afterEach(() => vi.useRealTimers());

  test("next week's weeknights are offered from the weeknight recipes, longest since made first, with why", async () => {
    await callServerFn(createRecipe, {
      name: "Laksa",
      parts: [{ name: "" }],
      facets: { ...noFacets(), week: ["weeknight"] },
      lastMade: "2026-09-15T08:00:00.000Z",
    });
    await callServerFn(createRecipe, {
      name: "Dal",
      parts: [{ name: "" }],
      facets: { ...noFacets(), week: ["weeknight"] },
      lastMade: "2026-08-01T08:00:00.000Z",
    });
    await callServerFn(createRecipe, { name: "Lamb shoulder", parts: [{ name: "" }], facets: { ...noFacets(), week: ["weekend"] } });
    const html = await renderRoute("/plan/fill");
    expect(html).toContain(">Plan the week</h1>");
    expect(html).toContain("21 – 27 Sep 2026");
    expect(html).toContain('aria-label="Planning steps"');
    expect(html).toContain("From your weeknight recipes, the ones you haven&#x27;t had for longest first.");
    expect(html.indexOf("Dal")).toBeLessThan(html.indexOf("Laksa"));
    expect(html).toContain("Last made 7 weeks ago");
    // Two weeknight recipes for five weeknights: the rest start as nights off.
    expect(html.match(/>Night off</g)?.length).toBeGreaterThanOrEqual(3);
    // The weekend recipe is the next step's, not a weeknight's.
    expect(html).not.toContain("Lamb shoulder");
  });

  test("a day that already holds something is left out, and no weeknight recipes says how to start", async () => {
    await callServerFn(addPlanEntry, { date: NEXT_MONDAY, text: "Leftovers" });
    const html = await renderRoute(`/plan/fill?week=${NEXT_MONDAY}`);
    expect(html).not.toContain('aria-label="Swap Mon"');
    expect(html).toContain('aria-label="Swap Tue"');
    expect(html).toContain("No recipes are marked Weeknight yet, so Swap offers any recipe.");
  });
});
