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
  ["/recipes/lemon-tart/edit", "Edit recipe"],
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

  test("cook mode is fullscreen: the outlet renders without either nav", async () => {
    const html = await render("/recipes/lemon-tart/cook");
    expect(html).toContain("Lemon tart");
    expect(html).not.toContain('aria-label="Main"');
  });

  test("unknown path renders the not-found view", async () => {
    const html = await render("/nowhere");
    expect(html).toContain("Not found");
    expect(html).toContain('href="/"');
  });

  test("only the current nav item is active", async () => {
    const html = await render("/settings");
    const active = html.match(/data-status="active"/g) ?? [];
    // One per nav (side + bottom).
    expect(active).toHaveLength(2);
    expect(html).toMatch(/href="\/settings"[^>]*data-status="active"|data-status="active"[^>]*href="\/settings"/);
  });
});

describe("route states", () => {
  test("pending shows a spinner with sr text", () => {
    const html = renderToString(<RoutePending />);
    expect(html).toContain("<svg");
    expect(html).toContain("Loading");
  });

  test("error shows the message and a retry button", () => {
    const html = renderToString(
      <RouteError error={new Error("boom")} reset={() => {}} info={{ componentStack: "" }} />,
    );
    expect(html).toContain("boom");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
  });
});
