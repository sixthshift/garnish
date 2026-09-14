// The editor's JSON toggle as the route renders it: the menu (M27.6) closed,
// with the form (not the textarea) showing until it is opened and chosen.
import { expect, test, vi } from "vitest";
import { renderRoute } from "../../../helpers/routes";
import { useTempDataDir } from "../../../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/timeline", local);
vi.mock("../../../../src/server/fns/units", local);
vi.mock("../../../../src/server/fns/tags", local);
vi.mock("../../../../src/server/fns/aisles", local);
vi.mock("../../../../src/server/fns/foods", local);

useTempDataDir();

test("the JSON view is offered but closed, so the form is what renders", async () => {
  const html = await renderRoute("/recipes/new?source=manual");
  // The toggle lives in a Menu (M27.6), closed by default like every other
  // menu in the app; the item itself (and its text) is not in the markup
  // until it is opened. See test/components/RecipeForm.test.tsx for that.
  expect(html).toContain('data-testid="menu-trigger"');
  expect(html).not.toContain('data-testid="json-toggle"');
  expect(html).not.toContain("Back to form");
  expect(html).not.toContain('data-testid="json-view"');
  expect(html).not.toContain('aria-label="Recipe JSON"');
  expect(html).not.toContain('data-testid="json-error"');
  expect(html).toMatch(/<input[^>]*name="name"/); // the fields, not the textarea
});
