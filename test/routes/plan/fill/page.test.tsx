// Plan the week (decisions.md row 192), the route end to end: its loader
// against a temp DATA_DIR, the clock pinned so "today" is a known day.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addPlanEntry } from "../../../../src/server/fns/plan";
import { createRecipe } from "../../../../src/server/fns/recipes";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/plan", local);
vi.mock("../../../../src/server/fns/recipes", local);

const NEXT_MONDAY = "2026-09-21";

describe("/plan/fill", () => {
  useTempDataDir();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T10:00:00")); // a Saturday
  });
  afterEach(() => vi.useRealTimers());

  test("next week's weeknights are offered from the rotation, longest since made first, with why", async () => {
    await callServerFn(createRecipe, { name: "Laksa", parts: [{ name: "" }], kind: "rotation", lastMade: "2026-09-15T08:00:00.000Z" });
    await callServerFn(createRecipe, { name: "Dal", parts: [{ name: "" }], kind: "rotation", lastMade: "2026-08-01T08:00:00.000Z" });
    await callServerFn(createRecipe, { name: "Lamb shoulder", parts: [{ name: "" }], kind: "weekend" });
    const html = await renderRoute("/plan/fill");
    expect(html).toContain(">Plan the week</h1>");
    expect(html).toContain("21 – 27 Sep 2026");
    expect(html).toContain('aria-label="Planning steps"');
    expect(html).toContain("From your rotation, the ones you haven&#x27;t had for longest first.");
    expect(html.indexOf("Dal")).toBeLessThan(html.indexOf("Laksa"));
    expect(html).toContain("Last made 7 weeks ago");
    // Two rotation recipes for five weeknights: the rest start as nights off.
    expect(html.match(/>Night off</g)?.length).toBeGreaterThanOrEqual(3);
    // The weekend recipe is the next step's, not a weeknight's.
    expect(html).not.toContain("Lamb shoulder");
  });

  test("a day that already holds something is left out, and an empty rotation says how to start one", async () => {
    await callServerFn(addPlanEntry, { date: NEXT_MONDAY, text: "Leftovers" });
    const html = await renderRoute(`/plan/fill?week=${NEXT_MONDAY}`);
    expect(html).not.toContain('aria-label="Swap Mon"');
    expect(html).toContain('aria-label="Swap Tue"');
    expect(html).toContain("No recipes are marked Rotation yet, so Swap offers any recipe.");
  });
});
