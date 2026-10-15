// Render every page route through the real route tree with a memory history.
// A stub that throws, a missing route, or a bad import shows up here before
// it does in the browser. Loaders run against a temp DATA_DIR; the server
// functions they call are swapped for in-process wrappers (see helpers/server).
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RouteError, RoutePending } from "../../src/components/shell/RouteStates";
import { createRecipe } from "../../src/server/fns/recipes";
import { renderRoute as render } from "../helpers/routes";
import { callServerFn, useTempDataDir } from "../helpers/server";

// vi.mock is hoisted above imports and needs literal specifiers, so the shared
// factory is hoisted with it and there is one call per module.
const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../src/server/fns/recipes", local);
vi.mock("../../src/server/fns/timeline", local);
vi.mock("../../src/server/fns/units", local);
vi.mock("../../src/server/fns/tags", local);
vi.mock("../../src/server/fns/aisles", local);
vi.mock("../../src/server/fns/shopping", local);

useTempDataDir();
beforeEach(async () => {
  await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "" }] });
});

const pages: Array<[string, string]> = [
  ["/", "Recipes"],
  ["/recipes/new", "New recipe"],
  ["/recipes/lemon-tart", "Lemon tart"],
  ["/shopping", "Shopping"],
  ["/settings", "Settings"],
];

describe("app shell", () => {
  test.each(pages)("%s renders inside the shell", async (path, text) => {
    const html = await render(path);
    expect(html).toContain(text);
    // Both navs are in the DOM; CSS decides which shows.
    expect(html.match(/aria-label="Main"/g)).toHaveLength(2);
    for (const label of ["Recipes", "Shopping", "Settings"]) expect(html).toContain(`>${label}</a>`);
    // New is an action on the recipes page, not a nav destination.
    expect(html).not.toContain(`>New</a>`);
  });

  test("the side nav is one screen tall and sticky, so the footer item stays in view on a long page", async () => {
    const html = await render("/");
    const aside = html.match(/<aside[^>]*class="([^"]*)"/)?.[1] ?? "";
    // As a plain flex child the aside stretches to the content's height, and
    // Settings' mt-auto would then sit below the fold.
    expect(aside).toContain("md:h-dvh");
    expect(aside).toContain("md:sticky");
    expect(aside).toContain("md:top-0");
  });

  // decisions.md row 169: the shell is drawn before the page is the
  // browser's, and offline one cached copy answers every address, so it must
  // read the same everywhere — both navs, no place marked, the tab bar kept.
  // What the address decides is drawn once hydrated: test/routes/shell.dom.test.tsx.
  test.each(["/recipes/lemon-tart/cook", "/recipes/lemon-tart/edit", "/recipes/new?source=manual", "/settings"])(
    "%s draws the same neutral shell before hydration",
    async (path) => {
      const html = await render(path);
      const navs = html.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/g) ?? [];
      expect(navs).toHaveLength(2);
      for (const nav of navs) {
        expect(nav).not.toContain('data-status="active"');
        expect(nav).not.toContain('aria-current="page"');
      }
      expect(html).toContain("[--app-bar:calc(2.75rem_+_1px_+_max(0.5rem,env(safe-area-inset-bottom)))]");
    }
  );

  test("the new-recipe chooser is a place and keeps the tab bar", async () => {
    const html = await render("/recipes/new");
    expect(html.match(/aria-label="Main"/g)).toHaveLength(2);
    // The bar's real height: 53px of bar plus the home indicator, not a round guess.
    expect(html).toContain("[--app-bar:calc(2.75rem_+_1px_+_max(0.5rem,env(safe-area-inset-bottom)))]");
  });

  test("the style page hides the tab bar too", async () => {
    // Not rendered: its loader asks after the model. The flag is the route's.
    const { Route } = await import("../../src/routes/recipes/recipe/style/route");
    expect(Route.options.staticData?.hideNav).toBe(true);
  });

  test("unknown path renders the not-found view", async () => {
    const html = await render("/nowhere");
    expect(html).toContain("Not found");
    expect(html).toContain('href="/"');
  });
});

describe("route states", () => {
  test("pending shows a spinner with sr text", () => {
    const html = renderToString(<RoutePending />);
    expect(html).toContain("<svg");
    expect(html).toContain("Loading");
  });

  test("error shows the message and a retry button", () => {
    const html = renderToString(<RouteError error={new Error("boom")} reset={() => {}} info={{ componentStack: "" }} />);
    expect(html).toContain("boom");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
  });
});
