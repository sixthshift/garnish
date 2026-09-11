// The timeline list under Notes: one card per logged cook, newest first as the
// repository returns them, each with its photo, comment and Delete. Rendered
// inside a throwaway router because the rows write through `useMutate`.
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { TimelineList } from "../../src/components/Timeline";
import type { TimelineEvent } from "../../src/domain/recipe";

const recipeId = "11111111-1111-4111-8111-111111111111";

const event = (overrides: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "22222222-2222-4222-8222-222222222222",
  recipeId,
  occurredOn: "2026-09-11",
  message: "Crispier at 220.",
  image: null,
  createdAt: "2026-09-11T02:30:00.000Z",
  ...overrides,
});

async function render(events: TimelineEvent[]): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <TimelineList events={events} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

test("shows a card per event with its date, comment and Delete", async () => {
  const html = await render([event()]);
  expect(html).toMatch(/11 Sept? 2026/);
  expect(html).toContain("Crispier at 220.");
  expect(html).toContain(">Delete<");
  expect(html).toContain('data-testid="timeline-event"');
});

test("keeps the order it is given, newest first", async () => {
  const html = await render([
    event({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", occurredOn: "2026-09-11", message: "Second go" }),
    event({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", occurredOn: "2026-03-04", message: "First go" }),
  ]);
  expect(html.indexOf("Second go")).toBeLessThan(html.indexOf("First go"));
});

test("an event with a photo renders it from the timeline image route", async () => {
  const html = await render([event({ image: "22222222-2222-4222-8222-222222222222.png" })]);
  expect(html).toContain("/api/images/timeline/22222222-2222-4222-8222-222222222222.png");
});

test("an event with no comment says so instead of leaving a gap", async () => {
  const html = await render([event({ message: "   " })]);
  expect(html).toContain("No comment");
});

test("no events renders nothing at all", async () => {
  expect(await render([])).not.toContain("timeline-event");
});

test("the Delete buttons are chrome the print stylesheet drops", async () => {
  expect(await render([event()])).toContain('data-print="hide"');
});
