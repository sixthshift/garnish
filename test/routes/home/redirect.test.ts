// `/` was the recipe grid until decisions.md row 190: Home's beforeLoad sends
// an old link carrying the grid's filters on to /recipes. The test router runs
// as the server, which does not follow a redirect, so the hook is called as
// the router calls it; e2e/smoke.spec.ts follows one in the browser.
import { isRedirect } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { Route } from "../../../src/routes/home/route";

function beforeLoad(search: Record<string, unknown>): unknown {
  try {
    (Route.options.beforeLoad as (ctx: { location: { search: Record<string, unknown> } }) => void)({ location: { search } });
    return null;
  } catch (thrown) {
    return thrown;
  }
}

test("the grid's filters go on to /recipes, and nothing else comes with them", () => {
  const thrown = beforeLoad({ q: "lemon", tags: ["baking"], utm: "x" });
  expect(isRedirect(thrown)).toBe(true);
  expect((thrown as { options: unknown }).options).toMatchObject({ to: "/recipes", search: { q: "lemon", tags: ["baking"] } });
});

test("a filter value the grid no longer accepts is dropped rather than failing", () => {
  expect((beforeLoad({ sort: "spiciness" }) as { options: unknown }).options).toMatchObject({ to: "/recipes", search: {} });
});

test("/ with nothing the grid reads stays Home", () => {
  expect(beforeLoad({})).toBeNull();
  expect(beforeLoad({ utm: "x" })).toBeNull();
});
