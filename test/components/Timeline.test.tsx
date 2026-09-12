// The timeline list under Notes: one card per logged cook, newest first as the
// repository returns them, each with its photo, comment and Delete, under a
// heading that carries the "Made this" button (M25.6). Rendered inside a
// throwaway router because the rows write through `useMutate`.
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TimelineList, saveCook, saveCookAndClearTicks } from "../../src/components/Timeline";
import type { TimelineEvent } from "../../src/domain/recipe";
import { getTicks, setIngredientTicked, type StorageLike } from "../../src/lib/ticks";

const recipeId = "11111111-1111-4111-8111-111111111111";

const recipe = { id: recipeId, name: "Lemon tart", rating: null };

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
  const rootRoute = createRootRoute({ component: () => <TimelineList events={events} recipe={recipe} /> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

/** An in-memory sessionStorage, so `clearTicksNow` reads and writes what a test seeds. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

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

test("no events shows the heading and its button, with 'Not made yet' standing in for the list", async () => {
  const html = await render([]);
  expect(html).not.toContain("timeline-event");
  expect(html).toContain(">Made this<");
  expect(html).toContain('data-testid="made-this"');
  expect(html).toContain("Not made yet");
});

test("logged events replace the 'Not made yet' fallback, but the heading and button stay", async () => {
  const html = await render([event()]);
  expect(html).not.toContain("Not made yet");
  expect(html).toContain('data-testid="made-this"');
});

test("the Delete buttons are chrome the print stylesheet drops", async () => {
  expect(await render([event()])).toContain('data-print="hide"');
});

describe("saveCook (M25.3)", () => {
  const input = { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null };
  const writes = () => ({
    createEvent: vi.fn().mockResolvedValue(event()),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
    rate: vi.fn().mockResolvedValue(undefined),
  });

  test("untouched stars write no rating", async () => {
    const w = writes();
    const created = await saveCook({ recipeId, event: input, photo: null, rating: null }, w);
    expect(created.id).toBe(event().id);
    expect(w.createEvent).toHaveBeenCalledWith(recipeId, input);
    expect(w.rate).not.toHaveBeenCalled();
    expect(w.uploadPhoto).not.toHaveBeenCalled();
  });

  test("touched stars write the rating alongside the event, 0 clearing it", async () => {
    const w = writes();
    await saveCook({ recipeId, event: input, photo: null, rating: 4 }, w);
    expect(w.rate).toHaveBeenCalledWith(recipeId, 4);

    const cleared = writes();
    await saveCook({ recipeId, event: input, photo: null, rating: 0 }, cleared);
    expect(cleared.rate).toHaveBeenCalledWith(recipeId, 0);
  });

  test("a photo is uploaded under the new event's id, before the rating", async () => {
    const w = writes();
    const photo = new File(["x"], "cook.png", { type: "image/png" });
    await saveCook({ recipeId, event: input, photo, rating: 5 }, w);
    expect(w.uploadPhoto).toHaveBeenCalledWith(event().id, photo);
    expect(w.uploadPhoto.mock.invocationCallOrder[0]!).toBeLessThan(w.rate.mock.invocationCallOrder[0]!);
  });
});

describe("saveCookAndClearTicks (M25.6)", () => {
  const input = { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null };
  const writes = () => ({
    createEvent: vi.fn().mockResolvedValue(event()),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
    rate: vi.fn().mockResolvedValue(undefined),
  });
  const ING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  test("a successful save clears the recipe's ticks", async () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, recipeId, ING_A, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const created = await saveCookAndClearTicks({ recipeId, event: input, photo: null, rating: null }, writes());

    expect(created.id).toBe(event().id);
    expect(getTicks(storage, recipeId)).toEqual({ ingredients: [], steps: [] });
  });

  test("does not clear another recipe's ticks", async () => {
    const otherRecipeId = "33333333-3333-4333-8333-333333333333";
    const storage = fakeStorage();
    setIngredientTicked(storage, otherRecipeId, ING_A, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    await saveCookAndClearTicks({ recipeId, event: input, photo: null, rating: null }, writes());

    expect(getTicks(storage, otherRecipeId).ingredients).toEqual([ING_A]);
  });
});
