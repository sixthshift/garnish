// The cook history at the foot of the page: a closed `Disclosure` titled
// "History", one compact row per logged cook (M30.3, decisions.md row 64).
// Rendered inside a throwaway router because the rows write through
// `useMutate`.
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Recipe, TimelineEvent } from "../../../../../src/domain/recipe";
import { getTicks, type StorageLike, setIngredientTicked } from "../../../../../src/lib/ticks";
import { saveCook, saveCookAndClearTicks } from "../../../../../src/routes/recipes/recipe/components/saveCook";
import { saveQuickEdit } from "../../../../../src/routes/recipes/recipe/components/saveQuickEdit";
import { TimelineList } from "../../../../../src/routes/recipes/recipe/components/Timeline";
import { offersSaveAsNote, withNoteFromCook } from "../../../../../src/routes/recipes/recipe/components/timelineNotes";

// `updateRecipe` is the only server call `saveQuickEdit` makes; kept here so
// the "save as note" test can compare what was sent with the stored document.
const sent = vi.hoisted(() => [] as Array<{ data: { id: string; doc: unknown } }>);
vi.mock("../../../../../src/server/fns/recipes", () => ({
  updateRecipe: (args: { data: { id: string; doc: unknown } }) => {
    sent.push(args);
    return Promise.resolve({});
  },
}));

const recipeId = "11111111-1111-4111-8111-111111111111";

const event = (overrides: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "22222222-2222-4222-8222-222222222222",
  recipeId,
  occurredOn: "2026-09-11",
  message: "Crispier at 220.",
  image: null,
  servings: null,
  createdAt: "2026-09-11T02:30:00.000Z",
  ...overrides,
});

/** A minimal stored recipe, with one note already, so a save-as-note test can tell "appended" from "replaced". */
const stored: Recipe = {
  id: recipeId,
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "",
  image: null,
  rating: null,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 0,
  yieldUnit: null,
  recipeYield: "",
  prepTime: null,
  performTime: null,
  sourceUrl: null,
  notes: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", title: "Tip", text: "Chill it." }],
  tags: [],
  parts: [
    {
      id: "22222222-2222-4222-8222-222222222221",
      name: "",
      ingredients: [],
      steps: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", text: "Mix.", ingredientIds: [], image: null }],
    },
  ],
  restyledAt: null,
  createdAt: "2026-03-04T02:30:00.000Z",
  updatedAt: "2026-03-04T02:30:00.000Z",
};

async function render(events: TimelineEvent[]): Promise<string> {
  const rootRoute = createRootRoute({ component: () => <TimelineList events={events} /> });
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

test("closed by default, titled History with the cook count in its hint", async () => {
  const html = await render([event(), event({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", occurredOn: "2026-03-04" })]);
  expect(html).toMatch(/<details data-disclosure[^>]*aria-label="History"/);
  expect(html).not.toContain('<details open=""');
  expect(html).toContain(">History<");
  expect(html).toContain("2 cooks");
});

test("a single cook reads '1 cook', not '1 cooks'", async () => {
  const html = await render([event()]);
  expect(html).toContain("1 cook<");
});

test("a compact row: date and comment on one line, truncated, with Delete in a row menu", async () => {
  const html = await render([event()]);
  expect(html).toMatch(/11 Sept? 2026/);
  expect(html).toContain("Crispier at 220.");
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('data-testid="timeline-event"');
  expect(html).not.toContain(">Delete<"); // it's inside the closed menu panel
  expect(html).toMatch(/aria-label="Actions for entry from 11 Sept? 2026"/);
  expect(html).not.toContain("<img"); // no photo on this event
});

test("keeps the order it is given, newest first", async () => {
  const html = await render([
    event({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", occurredOn: "2026-09-11", message: "Second go" }),
    event({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", occurredOn: "2026-03-04", message: "First go" }),
  ]);
  expect(html.indexOf("Second go")).toBeLessThan(html.indexOf("First go"));
});

test("a compact row with a photo shows a small square thumbnail", async () => {
  const html = await render([event({ image: "22222222-2222-4222-8222-222222222222.png" })]);
  expect(html).toMatch(/<img[^>]*src="\/api\/images\/timeline\/22222222-2222-4222-8222-222222222222\.png"[^>]*class="[^"]*size-12[^"]*object-cover[^"]*"/);
});

test("a cook logged with servings shows 'serves N'; one without shows nothing (M35.2)", async () => {
  const withServings = await render([event({ servings: 6 })]);
  expect(withServings).toContain('data-testid="timeline-servings"');
  expect(withServings).toContain("serves 6");

  const without = await render([event({ servings: null })]);
  expect(without).not.toContain('data-testid="timeline-servings"');
});

test("an event with no comment says so instead of leaving a gap", async () => {
  const html = await render([event({ message: "   " })]);
  expect(html).toContain("No comment");
});

test("no events renders nothing: no disclosure, no 'Not made yet'", async () => {
  const html = await render([]);
  expect(html).toBe("");
  expect(html).not.toContain("timeline-event");
  expect(html).not.toContain("Not made yet");
});

test("the row menu is chrome the print stylesheet drops", async () => {
  expect(await render([event()])).toContain('data-print="hide"');
});

// M25.3 had saveCook also write a rating when the sheet's stars were
// touched. M29.4 removed the stars from the sheet (rating lives in the
// header only), so saveCook is left with just the event and its photo.
describe("saveCook", () => {
  const input = { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null, servings: null };
  const writes = () => ({
    createEvent: vi.fn().mockResolvedValue(event()),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
  });

  test("creates the event and does not write a rating", async () => {
    const w = writes();
    const created = await saveCook({ recipeId, event: input, photo: null }, w);
    expect(created.id).toBe(event().id);
    expect(w.createEvent).toHaveBeenCalledWith(recipeId, input);
    expect(w.uploadPhoto).not.toHaveBeenCalled();
  });

  test("a photo is uploaded under the new event's id", async () => {
    const w = writes();
    const photo = new File(["x"], "cook.png", { type: "image/png" });
    await saveCook({ recipeId, event: input, photo }, w);
    expect(w.uploadPhoto).toHaveBeenCalledWith(event().id, photo);
  });
});

describe("saveCookAndClearTicks (M25.6)", () => {
  const input = { occurredOn: "2026-09-11", message: "Crispier at 220.", image: null, servings: null };
  const writes = () => ({
    createEvent: vi.fn().mockResolvedValue(event()),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
  });
  const ING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  test("a successful save clears the recipe's ticks", async () => {
    const storage = fakeStorage();
    setIngredientTicked(storage, recipeId, ING_A, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    const created = await saveCookAndClearTicks({ recipeId, event: input, photo: null }, writes());

    expect(created.id).toBe(event().id);
    expect(getTicks(storage, recipeId)).toEqual({ ingredients: [], steps: [] });
  });

  test("does not clear another recipe's ticks", async () => {
    const otherRecipeId = "33333333-3333-4333-8333-333333333333";
    const storage = fakeStorage();
    setIngredientTicked(storage, otherRecipeId, ING_A, true);
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };

    await saveCookAndClearTicks({ recipeId, event: input, photo: null }, writes());

    expect(getTicks(storage, otherRecipeId).ingredients).toEqual([ING_A]);
  });
});

// M30.4: a row's menu gains "Save as note", appending the comment to the
// recipe's notes through the stored document.
describe("withNoteFromCook", () => {
  test("appends exactly one note, dated and worded from the cook, keeping the ones already there", () => {
    const draft = withNoteFromCook(stored, event());

    expect(draft.notes).toHaveLength(2);
    expect(draft.notes[0]).toEqual(stored.notes[0]);
    expect(draft.notes[1]!.title).toBe("Made 11 Sept 2026");
    expect(draft.notes[1]!.text).toBe("Crispier at 220.");
  });

  test("trims the comment and gives the new note its own id", () => {
    const draft = withNoteFromCook(stored, event({ message: "  Crispier at 220.  " }));

    expect(draft.notes[1]!.text).toBe("Crispier at 220.");
    expect(draft.notes[1]!.id).not.toBe(stored.notes[0]!.id);
  });

  test("every other id in the document, and every other field, survives untouched", () => {
    const draft = withNoteFromCook(stored, event());

    expect(draft.id).toBe(stored.id);
    expect(draft.name).toBe(stored.name);
    expect(draft.parts).toEqual(stored.parts);
  });
});

describe("offersSaveAsNote", () => {
  test("only when there is a comment and a stored document to write it into", () => {
    expect(offersSaveAsNote(event(), true)).toBe(true);
    expect(offersSaveAsNote(event({ message: "   " }), true)).toBe(false);
    expect(offersSaveAsNote(event(), false)).toBe(false);
  });
});

describe("saving a comment as a note", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  test("sends the stored document plus one note through updateRecipe", async () => {
    await saveQuickEdit(withNoteFromCook(stored, event()), (write) => write());

    expect(sent).toHaveLength(1);
    expect(sent[0]!.data.id).toBe(stored.id);
    const doc = sent[0]!.data.doc as Recipe;
    expect(doc.notes).toHaveLength(2);
    expect(doc.notes[0]).toEqual(stored.notes[0]);
    expect(doc.notes[1]!.title).toBe("Made 11 Sept 2026");
    expect(doc.notes[1]!.text).toBe("Crispier at 220.");
    expect(doc.parts).toEqual(stored.parts);
  });
});
