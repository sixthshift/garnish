// Row 213: the recipe page is what is left open at the stove, so it holds the
// screen awake as cook mode does. `renderToString` runs no effects, so the
// hook is mocked and the test asserts the page asks for it.
import { expect, test, vi } from "vitest";
import { createRecipe } from "../../../../src/api/rpc/recipes";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

const wake = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../../../src/lib/useWakeLock", () => ({
  useWakeLock: () => {
    wake.calls += 1;
    return true;
  },
}));

const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/api/rpc/timeline", local);
vi.mock("../../../../src/api/rpc/units", local);
vi.mock("../../../../src/api/rpc/recipes", local);

useTempDataDir();

for (const layout of ["mobile", "desktop"] as const) {
  test(`the recipe page keeps the screen on (${layout})`, async () => {
    const recipe = await callServerFn(createRecipe, {
      name: "Lemon tart",
      parts: [{ name: "", ingredients: [], steps: [{ text: "Bake." }] }],
    });
    wake.calls = 0;
    const html = await renderRoute(`/recipes/${recipe.slug}`, layout);
    expect(html).toContain("Lemon tart");
    expect(wake.calls).toBeGreaterThan(0);
  });
}
