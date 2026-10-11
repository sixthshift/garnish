// Settings › Diagnostics: the build, and what went wrong, newest first, each
// opening onto its detail. Its pure helpers — the badge's count, the times in
// the household's words, the detail split into the stack and the rest — are
// tested on their own.
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import type { DiagnosticEvent } from "../../../src/db/models/diagnostic/repo";
import { buildLabel } from "../../../src/lib/version";
import { DiagnosticsTab, detailBlocks, eventHint, eventTime, recentCount } from "../../../src/routes/settings/components/tabs/DiagnosticsTab";

async function renderWithRouter(component: () => ReactNode): Promise<string> {
  const rootRoute = createRootRoute({ component });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

const NOW = new Date("2026-10-11T04:00:00.000Z");
const TZ = "Australia/Sydney";

const event = (over: Partial<DiagnosticEvent> = {}): DiagnosticEvent => ({
  id: "e1",
  occurredAt: "2026-10-11T03:14:00.000Z",
  source: "browser",
  level: "error",
  name: "/recipes/new",
  message: "(0 , k.createRequire) is not a function",
  detail: { where: "route", stack: "TypeError: x\n    at StyleSpace.js:1:2" },
  version: "1.4.0 (c4bd82d)",
  ...over,
});

test("the empty tab names the build and says nothing has gone wrong", async () => {
  const html = await renderWithRouter(() => <DiagnosticsTab events={[]} now={NOW} />);
  expect(html).toContain(buildLabel());
  expect(html).toContain('data-testid="diagnostics-empty"');
  expect(html).toContain("Nothing has gone wrong.");
  expect(html).not.toContain(">Clear<");
});

test("each event is a closed disclosure with its message, its detail and the build that saw it, and Clear is offered", async () => {
  const html = await renderWithRouter(() => (
    <DiagnosticsTab events={[event(), event({ id: "e2", level: "warning", source: "ai", name: "restyle", message: "flagged", detail: null })]} now={NOW} />
  ));
  expect(html.match(/data-testid="diagnostic-event"/g)).toHaveLength(2);
  expect(html).toContain("(0 , k.createRequire) is not a function");
  expect(html).toContain("StyleSpace.js:1:2");
  expect(html).toContain("Garnish 1.4.0 (c4bd82d)");
  expect(html).toContain(">Error<");
  expect(html).toContain(">Warning<");
  expect(html).toContain(">Clear<");
  expect(html).not.toMatch(/<details[^>]* open/);
});

test("recentCount is the last seven days' events", () => {
  const events = [{ occurredAt: "2026-10-11T00:00:00.000Z" }, { occurredAt: "2026-10-05T00:00:00.000Z" }, { occurredAt: "2026-10-01T00:00:00.000Z" }];
  expect(recentCount(events, NOW)).toBe(2);
  expect(recentCount([], NOW)).toBe(0);
});

test("eventTime says the time alone for today and the date before that", () => {
  expect(eventTime("2026-10-11T03:14:00.000Z", NOW, TZ)).toBe("Today 2:14 pm");
  expect(eventTime("2026-10-09T03:14:00.000Z", NOW, TZ)).toBe("9 Oct, 2:14 pm");
});

test("eventHint is when, from where, and what failed there", () => {
  expect(eventHint(event(), NOW, TZ)).toBe("Today 2:14 pm · Browser · /recipes/new");
  expect(eventHint(event({ source: "ai", name: "restyle" }), NOW, TZ)).toBe("Today 2:14 pm · AI · restyle");
});

test("detailBlocks sets the stack apart and shows the rest as JSON", () => {
  expect(detailBlocks(null)).toEqual({ stack: null, rest: null });
  expect(detailBlocks({ stack: "s" })).toEqual({ stack: "s", rest: null });
  expect(detailBlocks({ model: "sonnet", seconds: 2 })).toEqual({ stack: null, rest: '{\n  "model": "sonnet",\n  "seconds": 2\n}' });
});
