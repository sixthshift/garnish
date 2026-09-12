// The editor's M13.5 controls as the route renders them: the image URL field
// beside the picker, and the JSON toggle with the form (not the textarea)
// showing until it is pressed.
import { expect, test, vi } from "vitest";
import { renderRoute } from "../helpers/routes";
import { useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/recipes", local);
vi.mock("../../src/server/timeline", local);
vi.mock("../../src/server/units", local);
vi.mock("../../src/server/tags", local);
vi.mock("../../src/server/aisles", local);
vi.mock("../../src/server/foods", local);

useTempDataDir();

test("the image field takes a pasted URL", async () => {
  const html = await renderRoute("/recipes/new");
  expect(html).toContain('data-testid="image-url"');
  expect(html).toContain("Or paste an image URL");
  expect(html).toMatch(/<input[^>]*type="url"/);
  expect(html).toContain("Fetch");
  expect(html).not.toContain('data-testid="image-url-error"');
});

test("the JSON view is offered but closed, so the form is what renders", async () => {
  const html = await renderRoute("/recipes/new");
  expect(html).toContain('data-testid="json-toggle"');
  expect(html).toContain("Edit as JSON");
  expect(html).not.toContain("Back to form");
  expect(html).not.toContain('data-testid="json-view"');
  expect(html).not.toContain('aria-label="Recipe JSON"');
  expect(html).not.toContain('data-testid="json-error"');
  expect(html).toMatch(/<input[^>]*name="name"/); // the fields, not the textarea
});
