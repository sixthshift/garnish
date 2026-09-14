// M11.7 on the recipe view route, rendered through the real route tree: last
// made as text in the header's strip (M24.3 moved the "Made this" button out
// of the header; M30.3 moved it out of the timeline's own heading; M30.2
// moved it again, into the method column under the last step card, out of
// the row above the History disclosure), the cook history as a closed
// disclosure at the foot of the page, and the last made date the logged cook
// moved.
import { expect, test, vi } from "vitest";
import { createRecipe } from "../../../../src/server/fns/recipes";
import { createTimelineEvent, deleteTimelineEvent } from "../../../../src/server/fns/timeline";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/timeline", local);

useTempDataDir();

async function seedTart() {
  return callServerFn(createRecipe, {
    name: "Lemon tart",
    recipeServings: 4,
    parts: [{ name: "", ingredients: [], steps: [{ text: "Bake." }] }],
  });
}

const log = (recipeId: string, occurredOn: string, message: string) =>
  callServerFn(createTimelineEvent, { recipeId, event: { occurredOn, message, image: null } });

test("a recipe never cooked says so, offers the button, and has no History disclosure (M24.3, M30.3)", async () => {
  await seedTart();
  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain("Never made");
  expect(html).toContain('data-testid="made-this"');
  expect(html).not.toContain('data-testid="timeline"');
  expect(html).not.toContain(">History<");
  expect(html).not.toContain('data-testid="timeline-event"');
});

test("the Made this button sits in the method column, under the last step card, above the History disclosure (M30.2)", async () => {
  const tart = await seedTart();
  await log(tart.id, "2026-09-11", "Crispier at 220.");
  const html = await renderRoute("/recipes/lemon-tart");

  const methodColumn = html.indexOf('data-testid="method-column"');
  const lastStepCard = html.lastIndexOf('data-testid="step-card"');
  const madeThisRow = html.indexOf('data-testid="made-this-row"');
  const history = html.indexOf('aria-label="History"');

  expect(methodColumn).toBeGreaterThan(-1);
  expect(lastStepCard).toBeGreaterThan(methodColumn);
  expect(madeThisRow).toBeGreaterThan(lastStepCard);
  expect(history).toBeGreaterThan(madeThisRow);
  // The button itself is inside the row, and the row appears exactly once.
  expect(html.indexOf('data-testid="made-this"', madeThisRow)).toBeGreaterThan(madeThisRow);
  expect(html.indexOf('data-testid="made-this-row"', madeThisRow + 1)).toBe(-1);
});

test("a logged cook shows in the closed History disclosure and as the recipe's last made date", async () => {
  const tart = await seedTart();
  await log(tart.id, "2026-09-11", "Crispier at 220.");

  const html = await renderRoute("/recipes/lemon-tart");
  expect(html).toContain('data-testid="timeline-event"');
  expect(html).toContain("Crispier at 220.");
  expect(html).toMatch(/<details data-disclosure[^>]*aria-label="History"/);
  expect(html).not.toContain('<details open=""');
  expect(html).toContain("1 cook<");
  expect(html).toMatch(/Last made.*11 Sept? 2026/s);
  expect(html).not.toContain("Never made");
});

test("the history is newest first and falls back when the latest cook is deleted", async () => {
  const tart = await seedTart();
  await log(tart.id, "2026-03-04", "First go");
  const latest = await log(tart.id, "2026-09-11", "Second go");

  const html = await renderRoute("/recipes/lemon-tart");
  expect(html.indexOf("Second go")).toBeLessThan(html.indexOf("First go"));
  expect(html).toContain("2 cooks");

  await callServerFn(deleteTimelineEvent, { id: latest.id });
  const after = await renderRoute("/recipes/lemon-tart");
  expect(after).not.toContain("Second go");
  expect(after).toContain("First go");
  expect(after).toContain("1 cook<");
  expect(after).toMatch(/Last made.*4 Mar 2026/s);
});
