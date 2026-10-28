// Home end to end: the loader against a temp DATA_DIR, the clock pinned so
// "today" is a known day.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addPlanEntry } from "../../../src/server/fns/plan";
import { createRecipe } from "../../../src/server/fns/recipes";
import { addShoppingItems } from "../../../src/server/fns/shopping";
import { renderRoute } from "../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../src/server/fns/plan", local);
vi.mock("../../../src/server/fns/recipes", local);
vi.mock("../../../src/server/fns/shopping", local);

const WEDNESDAY = "2026-09-16";
const SATURDAY = "2026-09-19";

/** Pin the wall clock to midday on `date`, local time, faking only Date so the loaders' promises still run. */
function pin(date: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${date}T12:00:00`));
}

describe("/ (home)", () => {
  useTempDataDir();
  beforeEach(() => pin(WEDNESDAY));
  afterEach(() => vi.useRealTimers());

  test("tonight's recipe leads, with Start cooking into cook mode at the entry's servings", async () => {
    const tart = await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "" }], performTime: 40 });
    await callServerFn(addPlanEntry, { date: WEDNESDAY, recipeId: tart.id, text: "Lemon tart", servings: 6 });
    const html = await renderRoute("/");
    expect(html).toContain(">Wednesday</h1>");
    expect(html).toContain("16 September");
    expect(html).toContain("Lemon tart");
    expect(html).toContain('href="/recipes/lemon-tart/cook?servings=6"');
    expect(html).toContain('href="/recipes/lemon-tart"');
    expect(html).toContain("40 min");
  });

  test("an empty day says so, and the week, the list and next week still draw", async () => {
    await callServerFn(addShoppingItems, { items: [{ text: "Milk" }, { text: "Eggs" }] });
    const html = await renderRoute("/");
    expect(html).toContain("Nothing planned for tonight.");
    expect(html).toContain("This week");
    expect(html.match(/<li[^>]*aria-current="date"/g)).toHaveLength(1);
    expect(html).toContain("2 things left to buy");
    expect(html).toContain("Not planned yet.");
    expect(html).toContain('href="/plan/fill?week=2026-09-21"');
    // Through the week, planning next week is not the page's primary action.
    expect(html).not.toContain("Plan next week");
  });

  test("recipes never made wait under To try", async () => {
    await callServerFn(createRecipe, { name: "Miso eggplant", parts: [{ name: "" }] });
    const html = await renderRoute("/");
    expect(html).toContain("To try");
    expect(html).toContain('href="/recipes/miso-eggplant"');
  });

  test("at the weekend an empty next week becomes the call to action", async () => {
    pin(SATURDAY);
    const html = await renderRoute("/");
    expect(html).toContain(">Saturday</h1>");
    expect(html).toContain("Next week isn&#x27;t planned yet");
    expect(html).toContain("Plan next week");
    expect(html).toContain('href="/plan/fill?week=2026-09-21"');
  });
});
