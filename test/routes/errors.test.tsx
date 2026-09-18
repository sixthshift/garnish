// Error states end to end. Every server function is mocked to reject, so each
// route's loader fails and the router's default error component renders in
// the outlet: a message and a Retry, never a blank. Stands in for the plan's
// kill-the-server browser check: a dead server makes the browser's fetch
// reject with a TypeError, which is exactly what the first mock throws.
import { ErrorBoundary } from "@sixthshift/design-system/error-boundary";
import { OverlayProvider } from "@sixthshift/design-system/overlay";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppErrorFallback, ErrorView } from "../../src/components/shell/RouteStates";
import { describeError, isNetworkError } from "../../src/lib/errors";
import { TOAST_POSITION } from "../../src/lib/toast";
import { Route as RootRoute } from "../../src/routes/root";
import { renderRoute } from "../helpers/routes";

// The error every mocked server function rejects with; tests swap it.
const failure = vi.hoisted(() => ({ error: new TypeError("fetch failed") as unknown }));
const failing = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const original = await importOriginal();
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(original)) {
    out[name] = typeof value === "function" ? () => Promise.reject(failure.error) : value;
  }
  return out;
});
vi.mock("../../src/server/fns/recipes", failing);
vi.mock("../../src/server/fns/units", failing);
vi.mock("../../src/server/fns/tags", failing);
vi.mock("../../src/server/fns/aisles", failing);
vi.mock("../../src/server/fns/foods", failing);

beforeEach(() => {
  failure.error = new TypeError("fetch failed");
});

const pages = ["/", "/recipes/lemon-tart", "/recipes/lemon-tart/edit", "/recipes/lemon-tart/cook", "/recipes/new", "/settings"];

describe("server unreachable", () => {
  test.each(pages)("%s shows the can't-reach-the-server view with Retry", async (path) => {
    const html = await renderRoute(path);
    expect(html).toContain("data-error-view");
    expect(html).toContain("Can&#x27;t reach the server");
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(html).not.toContain("Something went wrong");
    expect(html).not.toContain("fetch failed"); // the raw message is not the copy
  });

  test("the shell stays up around the error on a page with a nav", async () => {
    const html = await renderRoute("/");
    expect(html.match(/aria-label="Main"/g)).toHaveLength(2);
  });

  test("each browser's fetch failure message counts as the network", async () => {
    for (const message of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "fetch failed"]) {
      failure.error = new TypeError(message);
      expect(await renderRoute("/settings")).toContain("Can&#x27;t reach the server");
    }
  });
});

describe("generic loader error", () => {
  test("shows Something went wrong with the message and Retry", async () => {
    failure.error = new Error("disk is full");
    const html = await renderRoute("/");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("disk is full");
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(html).not.toContain("reach the server");
  });

  test("a thrown non-Error still renders", async () => {
    failure.error = "nope";
    const html = await renderRoute("/settings");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("nope");
  });
});

describe("isNetworkError", () => {
  test("true for a fetch TypeError in any browser or Bun", () => {
    for (const message of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "fetch failed"]) {
      expect(isNetworkError(new TypeError(message))).toBe(true);
    }
  });

  test("false for other TypeErrors, other Errors and non-errors", () => {
    expect(isNetworkError(new TypeError("x is not a function"))).toBe(false);
    expect(isNetworkError(new Error("fetch failed"))).toBe(false);
    expect(isNetworkError("fetch failed")).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("describeError", () => {
  test("network while online blames the server", () => {
    expect(describeError(new TypeError("Failed to fetch"), true)).toEqual({
      title: "Can't reach the server",
      detail: "Garnish is not answering. Check it is running, then retry.",
      network: true,
    });
  });

  test("network while offline blames the connection", () => {
    const described = describeError(new TypeError("Failed to fetch"), false);
    expect(described.title).toBe("You are offline");
    expect(described.network).toBe(true);
  });

  test("anything else is shown as itself, and online makes no difference", () => {
    expect(describeError(new Error("boom"), true)).toEqual({ title: "Something went wrong", detail: "boom", network: false });
    expect(describeError(new Error("boom"), false).title).toBe("Something went wrong");
    expect(describeError("plain string").detail).toBe("plain string");
    expect(describeError(new Error("")).detail).toBe("No details were given.");
    expect(describeError(undefined).detail).toBe("undefined");
  });
});

describe("ErrorView and AppErrorFallback", () => {
  test("render without a router (bare) with the message and Retry", () => {
    const html = renderToString(<ErrorView error={new TypeError("fetch failed")} reset={() => {}} />);
    expect(html).toContain("Can&#x27;t reach the server");
    expect(html).toContain("Retry");
  });

  test("the app-wide fallback paints its own background so a shell-less page is not transparent", () => {
    const html = renderToString(<AppErrorFallback error={new Error("shell broke")} reset={() => {}} />);
    // The base surface, the same tone the shell paints: the fallback stands in
    // for the whole page, so it is the page's background it has to supply.
    expect(html).toContain("bg-bg-subtle");
    expect(html).toContain("shell broke");
    expect(html).toContain("Retry");
  });
});

describe("root route", () => {
  /** The root component is the overlay provider around the guarded shell; this is the provider element. */
  function rootElement(): ReactElement<{ toastClassName?: string; children: ReactElement[] }> {
    const component = RootRoute.options.component as unknown as (() => ReactElement) | undefined;
    expect(component).toBeDefined();
    return component!() as ReactElement<{ toastClassName?: string; children: ReactElement[] }>;
  }

  /** The provider's children: the boundary and what sits beside it. */
  function rootChildren(): ReactElement[] {
    return rootElement().props.children;
  }

  test("wraps the shell in the design system ErrorBoundary with the app fallback", () => {
    const element = rootChildren().find((child) => child.type === ErrorBoundary);
    expect(element).toBeDefined();
    const props = element!.props as { fallback: (p: { error: Error; reset: () => void }) => ReactElement };
    const fallback = props.fallback({ error: new Error("render blew up"), reset: () => {} });
    expect(fallback.type).toBe(AppErrorFallback);
    expect(renderToString(fallback)).toContain("render blew up");
  });

  test("the design system's overlay provider hosts the toast stack outside the boundary, placed above the bottom nav", () => {
    const element = rootElement();
    expect(element.type).toBe(OverlayProvider);
    expect(element.props.toastClassName).toBe(TOAST_POSITION);
    // The boundary is a child of the provider, so a shell error cannot unmount the stack.
    expect(rootChildren().some((child) => child.type === ErrorBoundary)).toBe(true);
  });
});
