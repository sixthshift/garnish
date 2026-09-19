// The recipe form's pure helpers, and the Check for M5.2: the default document
// the form submits (emptyDraft plus a name) saves and reads back with one
// component, plus the head of the form (M27.1). Most of the form's rendering is
// covered by the route tests in test/routes/loaders.test.tsx, which mount it
// with a router, as the two render tests at the foot of this file do.
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { draftFromRecipe, emptyDraft, hasDetails, isDirty, tagsFromNames, validateDraft } from "../../../../src/domain/draft";
import { type Recipe, recipeInputSchema } from "../../../../src/domain/recipe";
import { clearDraft, putDraft } from "../../../../src/lib/drafts";
import { RecipeForm, type RecipeFormProps } from "../../../../src/routes/recipes/components/RecipeForm";
import { detailsHint, parseAmount, parseMinutes, saveNotice } from "../../../../src/routes/recipes/components/recipeFormText";
import { createRecipe, getRecipe } from "../../../../src/server/fns/recipes";
import { renderRoute } from "../../../helpers/routes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

// The two render tests below go through the real routes, whose loaders call
// server functions; under vitest those need running in-process (see
// helpers/server.ts).
const local = vi.hoisted(() => async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const { runLocally } = await import("../../../helpers/server");
  return runLocally(await importOriginal());
});
vi.mock("../../../../src/server/fns/recipes", local);
vi.mock("../../../../src/server/fns/units", local);
vi.mock("../../../../src/server/fns/tags", local);
vi.mock("../../../../src/server/fns/foods", local);
vi.mock("../../../../src/server/fns/aisles", local);
vi.mock("../../../../src/server/fns/timeline", local);

useTempDataDir();

const weeknight = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Weeknight", slug: "weeknight" };
const gram = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "gram",
  pluralName: "grams",
  abbreviation: "g",
  useAbbreviation: true,
  fraction: false,
  standardQuantity: null,
  standardUnitId: null,
};

const stored: Recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "lemon-tart",
  name: "Lemon tart",
  description: "Sharp.",
  image: "11111111-1111-4111-8111-111111111111.jpg",
  rating: 4,
  lastMade: null,
  favourite: false,
  recipeServings: 4,
  recipeYieldQuantity: 1,
  yieldUnit: gram,
  recipeYield: "tart",
  prepTime: 20,
  performTime: 40,
  sourceUrl: null,
  notes: [{ id: "22222222-2222-4222-8222-222222222222", title: "Storage", text: "Two days." }],
  tags: [weeknight],
  parts: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Pastry",
      ingredients: [{ id: "44444444-4444-4444-8444-444444444444", quantity: 200, unit: gram, food: null, note: "flour", originalText: "", fixed: false }],
      steps: [{ id: "55555555-5555-4555-8555-555555555555", text: "Rub in.", title: "", summary: "", ingredientIds: [], image: null }],
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "",
      ingredients: [],
      steps: [{ id: "66666666-6666-4666-8666-666666666666", text: "Bake.", title: "", summary: "", ingredientIds: [], image: null }],
    },
  ],
  restyledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("emptyDraft", () => {
  test("is blank apart from one unnamed empty component, and fails validation only on the name", () => {
    const draft = emptyDraft();
    expect(draft.name).toBe("");
    expect(draft.parts).toHaveLength(1);
    expect(draft.parts[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(draft.parts[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(draft.tags).toEqual([]);
    expect(draft.rating).toBeNull();
    expect(draft.id).toBeUndefined();
    const result = validateDraft(draft);
    expect(result).toEqual({ ok: false, errors: { name: "Name is required" } });
  });

  test("with a name it is a valid RecipeInput", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.parts).toHaveLength(1);
  });

  test("returns a fresh object each time", () => {
    const a = emptyDraft();
    const b = emptyDraft();
    expect(a).not.toBe(b);
    expect(a.parts).not.toBe(b.parts);
  });
});

describe("draftFromRecipe", () => {
  test("drops slug and timestamps, keeps every other field and every id", () => {
    const draft = draftFromRecipe(stored);
    expect(draft).not.toHaveProperty("slug");
    expect(draft).not.toHaveProperty("createdAt");
    expect(draft).not.toHaveProperty("updatedAt");
    expect(draft.id).toBe(stored.id);
    expect(draft.name).toBe("Lemon tart");
    expect(draft.yieldUnit).toEqual(gram);
    expect(draft.tags).toEqual([weeknight]);
    expect(draft.parts).toEqual(stored.parts);
    expect(draft.notes).toEqual(stored.notes);
  });

  test("is a copy: editing the draft leaves the recipe alone", () => {
    const draft = draftFromRecipe(stored);
    draft.parts[0]!.name = "Changed";
    draft.tags.push(weeknight);
    expect(stored.parts[0]!.name).toBe("Pastry");
    expect(stored.tags).toHaveLength(1);
  });

  test("validates and parses back to the same document the server holds", () => {
    const result = validateDraft(draftFromRecipe(stored));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(recipeInputSchema.parse(stored));
  });
});

describe("validateDraft", () => {
  test("one message per failing field, keyed by path", () => {
    const result = validateDraft({ ...emptyDraft(), name: "   ", prepTime: 2.5, performTime: -1, recipeYieldQuantity: -2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBe("Name is required");
    expect(result.errors.prepTime).toBe("Enter whole minutes");
    expect(result.errors.performTime).toBe("Minutes cannot be negative");
    expect(result.errors.recipeYieldQuantity).toBe("Yield cannot be negative");
    expect(Object.keys(result.errors).sort()).toEqual(["name", "performTime", "prepTime", "recipeYieldQuantity"]);
  });

  test("nested paths are dotted", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast", parts: [{ name: "", ingredients: [{ quantity: -1 }], steps: [] }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["parts.0.ingredients.0.quantity"]);
  });

  test("a valid draft returns the parsed document with defaults applied", () => {
    const result = validateDraft({ ...emptyDraft(), name: " Toast " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Toast");
      expect(result.data.parts[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    }
  });
});

describe("tagsFromNames", () => {
  test("reuses a known tag by name, case-insensitively, and invents a reference for a new one", () => {
    const tags = tagsFromNames(["weeknight", "Baking"], [weeknight]);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toEqual(weeknight);
    expect(tags[1]!.name).toBe("Baking");
    expect(tags[1]!.slug).toBe("baking");
    expect(tags[1]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("trims, drops blanks and duplicates", () => {
    const tags = tagsFromNames([" Baking ", "", "baking", "  "], []);
    expect(tags.map((t) => t.name)).toEqual(["Baking"]);
  });

  test("a name with no slug characters still gets a non-empty slug", () => {
    expect(tagsFromNames(["!!!"], [])[0]!.slug).toBe("!!!");
  });

  test("every reference passes the tag schema inside a recipe document", () => {
    const result = validateDraft({ ...emptyDraft(), name: "Toast", tags: tagsFromNames(["Weeknight", "Crème brûlée"], []) });
    expect(result.ok).toBe(true);
  });
});

describe("parseAmount and parseMinutes", () => {
  test("parseAmount: blank or garbage is 0, otherwise the number", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("  ")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount("12")).toBe(12);
  });

  test("parseMinutes: blank or garbage is null, otherwise the number as typed", () => {
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes("x")).toBeNull();
    expect(parseMinutes("45")).toBe(45);
    expect(parseMinutes("2.5")).toBe(2.5); // left for zod to reject
  });
});

describe("Check: the form's default document round-trips", () => {
  test("emptyDraft plus a name creates a recipe with one component and reads back by slug", async () => {
    const created = await callServerFn(createRecipe, { ...emptyDraft(), name: "Toast" });
    expect(created.slug).toBe("toast");
    expect(created.parts).toHaveLength(1);
    const fetched = await callServerFn(getRecipe, { slug: "toast" });
    expect(fetched).toEqual(created);
    expect(fetched.parts[0]).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(fetched.tags).toEqual([]);
    expect(fetched.rating).toBeNull();
    // And the stored recipe becomes a draft that validates unchanged.
    const result = validateDraft(draftFromRecipe(fetched));
    expect(result.ok).toBe(true);
  });

  test("new tags typed by name are created on save", async () => {
    const created = await callServerFn(createRecipe, { ...emptyDraft(), name: "Toast", tags: tagsFromNames(["Breakfast"], []) });
    expect(created.tags).toHaveLength(1);
    expect(created.tags[0]).toMatchObject({ name: "Breakfast", slug: "breakfast" });
  });
});

describe("saveNotice", () => {
  test("names what happened, new or existing", () => {
    expect(saveNotice({ existing: false, imageError: null })).toEqual({ intent: "success", title: "Recipe created" });
    expect(saveNotice({ existing: true, imageError: null })).toEqual({ intent: "success", title: "Changes saved" });
  });

  test("a failed image downgrades the notice to a warning that names the reason; the document is still saved", () => {
    const notice = saveNotice({ existing: true, imageError: "file too large" });
    expect(notice.intent).toBe("warning");
    expect(notice.title).toBe("Changes saved");
    expect(notice.children).toContain("file too large");
  });
});

describe("isDirty", () => {
  test("a draft compared with itself, or with a deep copy, is clean", () => {
    const draft = draftFromRecipe(stored);
    expect(isDirty(draft, draft)).toBe(false);
    expect(isDirty(draft, draftFromRecipe(stored))).toBe(false);
    // Two blank drafts differ: each carries a component with a fresh id.
    expect(isDirty(emptyDraft(), emptyDraft())).toBe(true);
  });

  test("a changed field at any depth is dirty", () => {
    const initial = draftFromRecipe(stored);
    expect(isDirty(initial, { ...initial, name: "Lime tart" })).toBe(true);
    expect(isDirty(initial, { ...initial, prepTime: null })).toBe(true);
    expect(isDirty(initial, { ...initial, tags: [] })).toBe(true);
    const parts = initial.parts.map((part) => ({ ...part, steps: part.steps.map((step) => ({ ...step, text: "Rub in well." })) }));
    expect(isDirty(initial, { ...initial, parts })).toBe(true);
  });

  test("typing a field back to what it was is clean again", () => {
    const initial = draftFromRecipe(stored);
    const typed = { ...initial, name: "Lime tart" };
    expect(isDirty(initial, typed)).toBe(true);
    expect(isDirty(initial, { ...typed, name: "Lemon tart" })).toBe(false);
  });

  test("reordering a list is dirty; rewriting an object with its keys in another order is not", () => {
    const initial = draftFromRecipe(stored);
    const twoNotes = [...initial.notes, { id: "77777777-7777-4777-8777-777777777777", title: "Serve", text: "Cold." }];
    const reordered = { ...initial, notes: [...twoNotes].reverse() };
    expect(isDirty({ ...initial, notes: twoNotes }, reordered)).toBe(true);
    const note = initial.notes[0]!;
    expect(isDirty(initial, { ...initial, notes: [{ text: note.text, title: note.title, id: note.id }] })).toBe(false);
  });

  test("null, undefined and a missing id are told apart", () => {
    const initial = draftFromRecipe(stored);
    expect(isDirty(initial, { ...initial, rating: null })).toBe(true);
    expect(isDirty({ ...initial, id: undefined }, initial)).toBe(true);
    expect(isDirty({ ...emptyDraft(), parts: [] }, { ...emptyDraft(), parts: [] })).toBe(false);
  });
});

describe("hasDetails", () => {
  test("a blank recipe has nothing in Details, so it opens folded", () => {
    expect(hasDetails(emptyDraft())).toBe(false);
  });

  test.each([
    ["recipeYieldQuantity", { recipeYieldQuantity: 12 }],
    ["yieldUnit", { yieldUnit: gram }],
    ["recipeYield", { recipeYield: "muffins" }],
    ["prepTime", { prepTime: 20 }],
    ["performTime", { performTime: 40 }],
    ["tags", { tags: [weeknight] }],
    ["sourceUrl", { sourceUrl: "https://example.test/x" }],
  ])("any of %s opens it", (_field, patch) => {
    expect(hasDetails({ ...emptyDraft(), ...patch })).toBe(true);
  });

  test("what is not in Details does not open it", () => {
    expect(hasDetails({ ...emptyDraft(), name: "Toast", description: "Hot bread", recipeServings: 4, rating: 5 })).toBe(false);
  });

  test("a zero yield and a blank source are not values", () => {
    expect(hasDetails({ ...emptyDraft(), recipeYieldQuantity: 0, recipeYield: "  ", sourceUrl: "  " })).toBe(false);
  });
});

describe("detailsHint", () => {
  test("names what is in there", () => {
    expect(detailsHint({ ...emptyDraft(), recipeYield: "tart", prepTime: 20, tags: [weeknight], sourceUrl: "https://example.test/x" })).toBe(
      "yield, times, 1 tag, source"
    );
    expect(detailsHint({ ...emptyDraft(), tags: [weeknight, { ...weeknight, id: "x", name: "Baking", slug: "baking" }] })).toBe("2 tags");
  });

  test("says what could go in there when it is empty", () => {
    expect(detailsHint(emptyDraft())).toBe("Yield, times, tags, source");
  });
});

// M27.1: the head of the form. Rendered through the real routes, because the
// form needs a router (useNavigate, useBlocker). There is no DOM here, so the
// autofocus is asserted as the attribute React serialises, not as
// document.activeElement.
describe("the head of the form", () => {
  const head = (html: string) =>
    ['name="name"', 'name="description"', 'data-placeholder="image"', 'aria-label="Servings"'].map((needle) => html.indexOf(needle));

  test("a new recipe: name, description, image, servings, and the name is autofocused", async () => {
    const html = await renderRoute("/recipes/new?source=manual");
    const at = head(html);
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    const nameInput = /<input[^>]*name="name"[^>]*>/.exec(html)?.[0] ?? "";
    expect(nameInput).toContain('autofocus=""');
  });

  test("an existing recipe runs the same order and does not steal the focus", async () => {
    await callServerFn(createRecipe, { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }] });
    const html = await renderRoute("/recipes/lemon-tart/edit");
    const at = head(html);
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).not.toContain("autofocus");
  });
});

// M27.4: the draft that survives. The store itself is covered in
// test/lib/drafts.test.ts; here the form is mounted over an in-memory storage
// (the `storage` prop) to prove what it shows when it opens. Static render
// only — there is no jsdom in this project's vitest config, so Resume and
// Discard are asserted as the buttons the notice renders, and the clearing
// they and a save do is asserted against the store.
describe("the resume notice", () => {
  const draftStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
      size: () => map.size,
    };
  };

  const renderForm = async (props: Partial<RecipeFormProps>): Promise<string> => {
    const rootRoute = createRootRoute({ component: () => <RecipeForm initial={emptyDraft()} units={[]} tags={[]} {...props} /> });
    const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  };

  const initial = { ...emptyDraft(), name: "Toast" };
  const later = { ...initial, name: "Toast with jam" };

  test("a stored draft that differs from the form's shows Resume and Discard", async () => {
    const storage = draftStorage();
    putDraft(storage, undefined, later, false, "2026-09-11T05:04:00.000Z");
    const html = await renderForm({ initial, storage });
    expect(html).toContain('data-testid="draft-notice"');
    expect(html).toContain("You have unsaved changes from ");
    expect(html).toContain('data-testid="draft-resume"');
    expect(html).toContain("Resume");
    expect(html).toContain('data-testid="draft-discard"');
    expect(html).toContain("Discard");
    // The fields are still rendered while the choice is open.
    expect(html).toContain('name="name"');
  });

  test("no stored draft, no notice", async () => {
    const html = await renderForm({ initial, storage: draftStorage() });
    expect(html).not.toContain("draft-notice");
    expect(html).not.toContain("You have unsaved changes from");
  });

  test("a stored draft equal to the one the form opened on is not worth offering", async () => {
    const storage = draftStorage();
    putDraft(storage, undefined, initial, false, "2026-09-11T05:04:00.000Z");
    const html = await renderForm({ initial, storage });
    expect(html).not.toContain("draft-notice");
  });

  test("a draft that had an image says the picture was not kept", async () => {
    const storage = draftStorage();
    putDraft(storage, undefined, later, true, "2026-09-11T05:04:00.000Z");
    const html = await renderForm({ initial, storage });
    expect(html).toContain("The picture you chose was not kept; pick it again.");
  });

  test("an edit form reads its own recipe's key, not the new one", async () => {
    const storage = draftStorage();
    putDraft(storage, undefined, later, false, "2026-09-11T05:04:00.000Z");
    const existing = { id: stored.id, slug: stored.slug };
    expect(await renderForm({ initial, existing, storage })).not.toContain("draft-notice");
    putDraft(storage, stored.id, later, false, "2026-09-11T05:04:00.000Z");
    expect(await renderForm({ initial, existing, storage })).toContain('data-testid="draft-notice"');
  });

  test("a save clears the key the form wrote under", async () => {
    const storage = draftStorage();
    putDraft(storage, undefined, later, false, "2026-09-11T05:04:00.000Z");
    expect(await renderForm({ initial, storage })).toContain("draft-notice");
    // What `submit` does once the recipe is stored, and Discard on the leave guard.
    clearDraft(storage, undefined);
    expect(storage.size()).toBe(0);
    expect(await renderForm({ initial, storage })).not.toContain("draft-notice");
  });
});

// M27.6: "Edit as JSON" moved off the toolbar and into a one-item Menu at its
// end. The menu is closed by default like every other Menu in the app
// (RecipeActions, SortMenu), so there is no jsdom here to click it open —
// `jsonMenuOpen` is the same test-only seam SortMenu's `open` is, forwarded
// straight to the underlying `Menu`.
describe("the JSON toggle menu", () => {
  const renderForm = async (props: Partial<RecipeFormProps>): Promise<string> => {
    const rootRoute = createRootRoute({ component: () => <RecipeForm initial={emptyDraft()} units={[]} tags={[]} {...props} /> });
    const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  };

  test("closed by default: the trigger sits where the button was, no menuitem in the tree", async () => {
    const html = await renderForm({});
    expect(html).toContain('data-testid="menu-trigger"');
    expect(html).not.toContain('role="menuitem"');
    expect(html).not.toContain('data-testid="json-toggle"');
  });

  test("open, the one item reads Edit as JSON while the form is showing", async () => {
    const html = await renderForm({ jsonMenuOpen: true });
    expect(html).toContain('role="menuitem"');
    expect(html).toContain('data-testid="json-toggle"');
    expect(html).toContain("Edit as JSON");
    expect(html).not.toContain("Back to form");
  });
});
