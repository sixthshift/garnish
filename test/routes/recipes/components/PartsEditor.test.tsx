// The component editor's pure helpers, its rendering, and the Check for M5.3:
// a two-component recipe built with the helpers saves and reloads in order,
// and a move followed by an update reloads in the new order.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PartsEditor } from "../../../../src/routes/recipes/components/PartsEditor";
import { addPart, hasContent, ingredientLine, isBare, movePart, newPart, removePart, renamePart, type DraftPart, type RecipeDraft, emptyDraft, validateDraft } from "../../../../src/domain/draft";
import { partLabel, contentSummary } from "../../../../src/routes/recipes/components/PartsEditor";
import { createRecipe, getRecipe, updateRecipe } from "../../../../src/server/fns/recipes";
import { callServerFn, useTempDataDir } from "../../../helpers/server";

useTempDataDir();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

/** A two-component draft built with the helpers: Pastry then Filling, one ingredient and one step each. */
function tart(): RecipeDraft {
  let draft = renamePart({ ...emptyDraft(), name: "Lemon tart" }, 0, "Pastry");
  draft = addPart(draft, "Filling");
  const [pastry, filling] = draft.parts as [DraftPart, DraftPart];
  pastry.ingredients = [{ quantity: 200, unit: gram, note: "flour" }];
  pastry.steps = [{ text: "Rub in." }];
  filling.ingredients = [{ quantity: 3, note: "lemons" }];
  filling.steps = [{ text: "Whisk." }];
  return draft;
}

/** The opening tag of the control carrying `label`. */
function tagWithLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${label}"[^>]*>`));
  if (!match) throw new Error(`no control labelled ${label}`);
  return match[0];
}

describe("newPart and addPart", () => {
  test("a new component is blank with a fresh uuid", () => {
    const component = newPart();
    expect(component).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(component.id).toMatch(UUID);
    expect(newPart("Filling").name).toBe("Filling");
    expect(newPart().id).not.toBe(component.id);
  });

  test("appends without touching the original draft", () => {
    const draft = emptyDraft();
    const next = addPart(draft, "Filling");
    expect(next.parts).toHaveLength(2);
    expect(next.parts[1]).toMatchObject({ name: "Filling", ingredients: [], steps: [] });
    expect(next.parts[0]).toBe(draft.parts[0]);
    expect(draft.parts).toHaveLength(1);
    expect(next).not.toBe(draft);
  });

  test("the result still validates", () => {
    expect(validateDraft(addPart({ ...emptyDraft(), name: "Toast" })).ok).toBe(true);
  });
});

describe("renamePart", () => {
  test("renames only the indexed component, keeping its id and rows", () => {
    const draft = tart();
    const next = renamePart(draft, 1, "Curd");
    expect(next.parts[1]).toMatchObject({ id: draft.parts[1]!.id, name: "Curd" });
    expect(next.parts[1]!.ingredients).toBe(draft.parts[1]!.ingredients);
    expect(next.parts[0]).toBe(draft.parts[0]);
    expect(draft.parts[1]!.name).toBe("Filling");
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = tart();
    expect(renamePart(draft, 5, "x").parts).toEqual(draft.parts);
    expect(renamePart(draft, -1, "x").parts).toEqual(draft.parts);
  });
});

describe("removePart", () => {
  test("drops the indexed component", () => {
    const draft = tart();
    const next = removePart(draft, 0);
    expect(next.parts.map((c) => c.name)).toEqual(["Filling"]);
    expect(draft.parts).toHaveLength(2);
  });

  test("never removes the last component, and ignores an out-of-range index", () => {
    const one = emptyDraft();
    expect(removePart(one, 0).parts).toEqual(one.parts);
    expect(removePart(one, 0).parts).not.toBe(one.parts);
    const two = tart();
    expect(removePart(two, 2).parts).toEqual(two.parts);
    expect(removePart(two, -1).parts).toEqual(two.parts);
  });
});

describe("movePart", () => {
  test("swaps two components and leaves the original alone", () => {
    const draft = tart();
    const next = movePart(draft, 0, 1);
    expect(next.parts.map((c) => c.name)).toEqual(["Filling", "Pastry"]);
    expect(draft.parts.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
  });

  test("out-of-range or same index is a copy in the original order", () => {
    const draft = tart();
    expect(movePart(draft, 0, 0).parts).toEqual(draft.parts);
    expect(movePart(draft, 0, 2).parts).toEqual(draft.parts);
  });
});

describe("hasContent, partLabel, contentSummary", () => {
  test("hasContent is true with any ingredient or step", () => {
    expect(hasContent(newPart())).toBe(false);
    expect(hasContent({ ...newPart(), ingredients: [{ note: "salt" }] })).toBe(true);
    expect(hasContent({ ...newPart(), steps: [{ text: "Mix." }] })).toBe(true);
  });

  test("partLabel uses the name, else a numbered fallback", () => {
    expect(partLabel(newPart("Pastry"), 0)).toBe("Pastry");
    expect(partLabel(newPart("  "), 1)).toBe("part 2");
    expect(partLabel({ ingredients: [], steps: [] }, 0)).toBe("part 1");
  });

  test("contentSummary counts with plurals", () => {
    const [pastry] = tart().parts;
    expect(contentSummary(pastry!)).toBe("1 ingredient and 1 step");
    expect(contentSummary({ ...newPart(), ingredients: [{ note: "a" }, { note: "b" }] })).toBe("2 ingredients");
    expect(contentSummary({ ...newPart(), steps: [{ text: "a" }, { text: "b" }, { text: "c" }] })).toBe("3 steps");
    expect(contentSummary(newPart())).toBe("");
  });
});

describe("ingredientLine", () => {
  test("fills defaults then formats like the recipe page", () => {
    expect(ingredientLine({ quantity: 200, unit: gram, note: "flour" })).toBe("200 g, flour");
    expect(ingredientLine({ quantity: 2, food: { id: gram.id, name: "egg", pluralName: "eggs" } })).toBe("2 eggs");
    expect(ingredientLine({ originalText: "a pinch of salt" })).toBe("a pinch of salt");
    expect(ingredientLine({})).toBe("");
  });

  test("a row the schema rejects falls back to its raw text", () => {
    expect(ingredientLine({ quantity: -1, originalText: "  -1 cup flour " })).toBe("-1 cup flour");
    expect(ingredientLine({ quantity: -1, note: "flour" })).toBe("flour");
  });
});

describe("PartsEditor", () => {
  test("renders a name input per component in order, with its ingredient and step rows", () => {
    const html = renderToString(<PartsEditor draft={tart()} onChange={() => {}} />);
    expect(html).toContain('aria-label="Parts"');
    expect(html).toContain(">Add part<");
    expect(tagWithLabel(html, "Part 1 name")).toContain('value="Pastry"');
    expect(tagWithLabel(html, "Part 2 name")).toContain('value="Filling"');
    expect(html.indexOf('value="Pastry"')).toBeLessThan(html.indexOf('value="Filling"'));
    expect(tagWithLabel(html, "Ingredient 1 quantity")).toContain('value="200"');
    expect(html).toContain("Rub in.");
    expect(html).toContain('value="lemons"');
    expect(html).toContain("Whisk.");
    expect(html.indexOf("Rub in.")).toBeLessThan(html.indexOf('value="Filling"'));
    // Ingredient rows are inputs (M5.4); step rows are textareas (M5.5).
    expect(html).toMatch(/<input[^>]*name="parts\.0\.ingredients\.0\.quantity"/);
    expect(html).toMatch(/<input[^>]*name="parts\.1\.ingredients\.0\.quantity"/);
    expect(html).toMatch(/<textarea[^>]*name="parts\.0\.steps\.0\.text"[^>]*>Rub in\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="parts\.1\.steps\.0\.text"[^>]*>Whisk\.<\/textarea>/);
    // Reorder and remove controls per row.
    expect(html.match(/aria-label="Move part \d up"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Move part \d down"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Remove part \d"/g)).toHaveLength(2);
    expect(tagWithLabel(html, "Move part 1 up")).toContain('disabled=""');
    expect(tagWithLabel(html, "Move part 2 down")).toContain('disabled=""');
    // The confirm is not mounted until asked.
    expect(html).not.toContain('role="dialog"');
  });

  test("a flat recipe prints its two lists with no part chrome at all (M21.1)", () => {
    const html = renderToString(<PartsEditor draft={emptyDraft()} onChange={() => {}} />);
    expect(html).toContain('data-bare=""');
    expect(html).not.toContain('aria-label="Part 1 name"');
    expect(html).not.toContain("Part name"); // no placeholder either
    expect(html).not.toContain(">Parts<"); // no heading
    expect(html).not.toContain("Remove part");
    expect(html).not.toContain("Move part");
    // The lists themselves are all there, and so is the way out.
    expect(html).toContain("One ingredient per line"); // the empty list's textarea (M27.2)
    expect(html).toContain("The method, a blank line between steps"); // the empty step list's textarea (M27.3)
    expect(html).not.toContain("No parts yet");
    expect(html).toContain(">Add part<");
  });

  test("a sole part that has been named keeps its chrome", () => {
    const named = { ...emptyDraft(), parts: [{ ...emptyDraft().parts[0]!, name: "Pastry" }] };
    const html = renderToString(<PartsEditor draft={named} onChange={() => {}} />);
    expect(html).not.toContain('data-bare=""');
    expect(html).toContain('aria-label="Part 1 name"');
    expect(html).toContain(">Parts<");
    // Still the only part, so still nothing to remove it with.
    expect(html).not.toContain("Remove part");
  });

  test("Add part on a flat recipe keeps its rows and gives both parts a name field", () => {
    const base = emptyDraft();
    const flat: RecipeDraft = { ...base, parts: [{ ...base.parts[0]!, steps: [{ id: "s1", text: "Mix." }] }] };
    // The bare branch's one control is Add part, which is `addPart`.
    expect(isBare(flat)).toBe(true);
    const next: RecipeDraft = addPart(flat);
    expect(isBare(next)).toBe(false);
    expect(next.parts).toHaveLength(2);
    expect(next.parts[0]!.steps).toEqual(flat.parts[0]!.steps);
    const html = renderToString(<PartsEditor draft={next} onChange={() => {}} />);
    expect(html).toContain('aria-label="Part 1 name"');
    expect(html).toContain('aria-label="Part 2 name"');
    expect(html).toMatch(/<textarea[^>]*name="parts\.0\.steps\.0\.text"[^>]*>Mix\.<\/textarea>/);
  });

  test("a draft with no components says so instead of rendering an empty list", () => {
    const html = renderToString(<PartsEditor draft={{ ...emptyDraft(), parts: [] }} onChange={() => {}} />);
    expect(html).toContain("No parts yet");
    expect(html).not.toContain('aria-label="Part 1 name"');
    expect(html).toContain(">Add part<"); // the way out of the empty state
  });

  test("disabled disables the add button on a flat recipe too", () => {
    const html = renderToString(<PartsEditor draft={emptyDraft()} onChange={() => {}} disabled />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add part</);
  });

  test("disabled disables the inputs and the add button", () => {
    const html = renderToString(<PartsEditor draft={tart()} onChange={() => {}} disabled />);
    expect(tagWithLabel(html, "Part 1 name")).toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add part</);
  });
});

describe("Check: a two-component recipe saves and reloads in order", () => {
  test("create, read back, move, update, read back", async () => {
    const draft = tart();
    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await callServerFn(createRecipe, parsed.data);
    expect(created.parts.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
    // The client's component ids are kept, so rows keep their keys after save.
    expect(created.parts.map((c) => c.id)).toEqual(draft.parts.map((c) => c.id));

    let fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.parts.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
    expect(fetched.parts[0]!.ingredients.map((i) => i.note)).toEqual(["flour"]);
    expect(fetched.parts[0]!.steps.map((s) => s.text)).toEqual(["Rub in."]);
    expect(fetched.parts[1]!.ingredients.map((i) => i.note)).toEqual(["lemons"]);
    expect(fetched.parts[1]!.steps.map((s) => s.text)).toEqual(["Whisk."]);

    // Swap them, save, and the stored order follows the array.
    const swapped = validateDraft(movePart({ ...draft, id: created.id }, 0, 1));
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const updated = await callServerFn(updateRecipe, { id: created.id, doc: swapped.data });
    expect(updated.parts.map((c) => c.name)).toEqual(["Filling", "Pastry"]);

    fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.parts.map((c) => c.name)).toEqual(["Filling", "Pastry"]);
    expect(fetched.parts[0]!.steps.map((s) => s.text)).toEqual(["Whisk."]);
    expect(fetched.parts[1]!.steps.map((s) => s.text)).toEqual(["Rub in."]);
    expect(fetched.parts.map((c) => c.id)).toEqual([draft.parts[1]!.id, draft.parts[0]!.id]);
  });
});
