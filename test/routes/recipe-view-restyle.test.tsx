// `?restyle` on the recipe page (M37.6): the search param a URL import's
// Create lands on, which opens the restyle sheet, and which does nothing when
// no model is configured.
//
// The design system's `Sheet` mounts through a portal and paints nothing on a
// server render, so it is stubbed here with a plain div that renders its
// children while it is open. That makes "the sheet is open" observable in the
// rendered string without a DOM, which is the only thing these two tests are
// about; what the sheet itself renders is covered by
// test/components/RestyleSheet.test.tsx.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createRecipe } from "../../src/server/fns/recipes";
import { renderRoute } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/fns/recipes", local);
vi.mock("../../src/server/fns/timeline", local);
vi.mock("../../src/server/fns/style", local);

/** Whether a model is configured, as the loader's `aiImportAvailable` answers it. */
const ai = vi.hoisted(() => ({ available: false }));
vi.mock("../../src/server/fns/import", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  aiImportAvailable: async () => ({ available: ai.available }),
}));

vi.mock("@sixthshift/design-system/sheet", async () => {
  const { createElement } = await import("react");
  type Props = { open?: boolean; children?: unknown };
  const passthrough = ({ children }: Props) => createElement("div", null, children as never);
  const Sheet = Object.assign(
    ({ open, children }: Props) => (open === true ? createElement("div", { "data-testid": "sheet" }, children as never) : null),
    { Header: passthrough, Body: passthrough, Footer: passthrough },
  );
  return { Sheet };
});

useTempDataDir();

beforeEach(() => {
  ai.available = true;
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

async function seedRagu() {
  return callServerFn(createRecipe, {
    name: "Ragu",
    recipeServings: 4,
    parts: [{ name: "", ingredients: [], steps: [{ text: "Fry the onion for 5 minutes." }] }],
  });
}

test("?restyle opens the sheet when a model is configured", async () => {
  await seedRagu();
  const html = await renderRoute("/recipes/ragu?restyle=true");
  expect(html).toContain('data-testid="sheet"');
  expect(html).toContain("Restyle steps");
  expect(html).toContain('data-testid="restyle-rules"');
});

test("?restyle does nothing when no model is configured", async () => {
  ai.available = false;
  await seedRagu();
  const html = await renderRoute("/recipes/ragu?restyle=true");
  expect(html).not.toContain('data-testid="sheet"');
  expect(html).not.toContain('data-testid="restyle-rules"');
});

test("without the param the sheet stays shut, model or no model", async () => {
  await seedRagu();
  const html = await renderRoute("/recipes/ragu");
  expect(html).not.toContain('data-testid="sheet"');
});
