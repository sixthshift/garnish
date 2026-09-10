// The component editor's pure helpers, its rendering, and the Check for M5.3:
// a two-component recipe built with the helpers saves and reloads in order,
// and a move followed by an update reloads in the new order.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  addComponent,
  componentLabel,
  ComponentsEditor,
  contentSummary,
  hasContent,
  ingredientLine,
  moveComponent,
  newComponent,
  removeComponent,
  renameComponent,
} from "../../src/components/ComponentsEditor";
import { type DraftComponent, emptyDraft, type RecipeDraft, validateDraft } from "../../src/components/RecipeForm";
import { createRecipe, getRecipe, updateRecipe } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

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
  let draft = renameComponent({ ...emptyDraft(), name: "Lemon tart" }, 0, "Pastry");
  draft = addComponent(draft, "Filling");
  const [pastry, filling] = draft.components as [DraftComponent, DraftComponent];
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

describe("newComponent and addComponent", () => {
  test("a new component is blank with a fresh uuid", () => {
    const component = newComponent();
    expect(component).toMatchObject({ name: "", ingredients: [], steps: [] });
    expect(component.id).toMatch(UUID);
    expect(newComponent("Filling").name).toBe("Filling");
    expect(newComponent().id).not.toBe(component.id);
  });

  test("appends without touching the original draft", () => {
    const draft = emptyDraft();
    const next = addComponent(draft, "Filling");
    expect(next.components).toHaveLength(2);
    expect(next.components[1]).toMatchObject({ name: "Filling", ingredients: [], steps: [] });
    expect(next.components[0]).toBe(draft.components[0]);
    expect(draft.components).toHaveLength(1);
    expect(next).not.toBe(draft);
  });

  test("the result still validates", () => {
    expect(validateDraft(addComponent({ ...emptyDraft(), name: "Toast" })).ok).toBe(true);
  });
});

describe("renameComponent", () => {
  test("renames only the indexed component, keeping its id and rows", () => {
    const draft = tart();
    const next = renameComponent(draft, 1, "Curd");
    expect(next.components[1]).toMatchObject({ id: draft.components[1]!.id, name: "Curd" });
    expect(next.components[1]!.ingredients).toBe(draft.components[1]!.ingredients);
    expect(next.components[0]).toBe(draft.components[0]);
    expect(draft.components[1]!.name).toBe("Filling");
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = tart();
    expect(renameComponent(draft, 5, "x").components).toEqual(draft.components);
    expect(renameComponent(draft, -1, "x").components).toEqual(draft.components);
  });
});

describe("removeComponent", () => {
  test("drops the indexed component", () => {
    const draft = tart();
    const next = removeComponent(draft, 0);
    expect(next.components.map((c) => c.name)).toEqual(["Filling"]);
    expect(draft.components).toHaveLength(2);
  });

  test("never removes the last component, and ignores an out-of-range index", () => {
    const one = emptyDraft();
    expect(removeComponent(one, 0).components).toEqual(one.components);
    expect(removeComponent(one, 0).components).not.toBe(one.components);
    const two = tart();
    expect(removeComponent(two, 2).components).toEqual(two.components);
    expect(removeComponent(two, -1).components).toEqual(two.components);
  });
});

describe("moveComponent", () => {
  test("swaps two components and leaves the original alone", () => {
    const draft = tart();
    const next = moveComponent(draft, 0, 1);
    expect(next.components.map((c) => c.name)).toEqual(["Filling", "Pastry"]);
    expect(draft.components.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
  });

  test("out-of-range or same index is a copy in the original order", () => {
    const draft = tart();
    expect(moveComponent(draft, 0, 0).components).toEqual(draft.components);
    expect(moveComponent(draft, 0, 2).components).toEqual(draft.components);
  });
});

describe("hasContent, componentLabel, contentSummary", () => {
  test("hasContent is true with any ingredient or step", () => {
    expect(hasContent(newComponent())).toBe(false);
    expect(hasContent({ ...newComponent(), ingredients: [{ note: "salt" }] })).toBe(true);
    expect(hasContent({ ...newComponent(), steps: [{ text: "Mix." }] })).toBe(true);
  });

  test("componentLabel uses the name, else a numbered fallback", () => {
    expect(componentLabel(newComponent("Pastry"), 0)).toBe("Pastry");
    expect(componentLabel(newComponent("  "), 1)).toBe("component 2");
    expect(componentLabel({ ingredients: [], steps: [] }, 0)).toBe("component 1");
  });

  test("contentSummary counts with plurals", () => {
    const [pastry] = tart().components;
    expect(contentSummary(pastry!)).toBe("1 ingredient and 1 step");
    expect(contentSummary({ ...newComponent(), ingredients: [{ note: "a" }, { note: "b" }] })).toBe("2 ingredients");
    expect(contentSummary({ ...newComponent(), steps: [{ text: "a" }, { text: "b" }, { text: "c" }] })).toBe("3 steps");
    expect(contentSummary(newComponent())).toBe("");
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

describe("ComponentsEditor", () => {
  test("renders a name input per component in order, with its ingredients and numbered steps read-only", () => {
    const html = renderToString(<ComponentsEditor draft={tart()} onChange={() => {}} />);
    expect(html).toContain('aria-label="Components"');
    expect(html).toContain(">Add component<");
    expect(tagWithLabel(html, "Component 1 name")).toContain('value="Pastry"');
    expect(tagWithLabel(html, "Component 2 name")).toContain('value="Filling"');
    expect(html.indexOf('value="Pastry"')).toBeLessThan(html.indexOf('value="Filling"'));
    expect(html).toContain("200 g, flour");
    expect(html).toContain("Rub in.");
    expect(html).toContain("3, lemons");
    expect(html).toContain("Whisk.");
    expect(html.indexOf("Rub in.")).toBeLessThan(html.indexOf('value="Filling"'));
    // Read-only: no ingredient or step inputs yet.
    expect(html).not.toMatch(/<input[^>]*name="components\.\d+\.ingredients/);
    expect(html).not.toMatch(/name="components\.\d+\.steps/);
    // Reorder and remove controls per row.
    expect(html.match(/aria-label="Move component \d up"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Move component \d down"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Remove component \d"/g)).toHaveLength(2);
    expect(tagWithLabel(html, "Move component 1 up")).toContain('disabled=""');
    expect(tagWithLabel(html, "Move component 2 down")).toContain('disabled=""');
    // The confirm is not mounted until asked.
    expect(html).not.toContain('role="dialog"');
  });

  test("a sole component has no remove button, and empty lists say so", () => {
    const html = renderToString(<ComponentsEditor draft={emptyDraft()} onChange={() => {}} />);
    expect(html).toContain('aria-label="Component 1 name"');
    expect(html).not.toContain("Remove component");
    expect(html).toContain("No ingredients yet");
    expect(html).toContain("No steps yet");
  });

  test("disabled disables the inputs and the add button", () => {
    const html = renderToString(<ComponentsEditor draft={tart()} onChange={() => {}} disabled />);
    expect(tagWithLabel(html, "Component 1 name")).toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add component</);
  });
});

describe("Check: a two-component recipe saves and reloads in order", () => {
  test("create, read back, move, update, read back", async () => {
    const draft = tart();
    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await callServerFn(createRecipe, parsed.data);
    expect(created.components.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
    // The client's component ids are kept, so rows keep their keys after save.
    expect(created.components.map((c) => c.id)).toEqual(draft.components.map((c) => c.id));

    let fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.components.map((c) => c.name)).toEqual(["Pastry", "Filling"]);
    expect(fetched.components[0]!.ingredients.map((i) => i.note)).toEqual(["flour"]);
    expect(fetched.components[0]!.steps.map((s) => s.text)).toEqual(["Rub in."]);
    expect(fetched.components[1]!.ingredients.map((i) => i.note)).toEqual(["lemons"]);
    expect(fetched.components[1]!.steps.map((s) => s.text)).toEqual(["Whisk."]);

    // Swap them, save, and the stored order follows the array.
    const swapped = validateDraft(moveComponent({ ...draft, id: created.id }, 0, 1));
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const updated = await callServerFn(updateRecipe, { id: created.id, doc: swapped.data });
    expect(updated.components.map((c) => c.name)).toEqual(["Filling", "Pastry"]);

    fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.components.map((c) => c.name)).toEqual(["Filling", "Pastry"]);
    expect(fetched.components[0]!.steps.map((s) => s.text)).toEqual(["Whisk."]);
    expect(fetched.components[1]!.steps.map((s) => s.text)).toEqual(["Rub in."]);
    expect(fetched.components.map((c) => c.id)).toEqual([draft.components[1]!.id, draft.components[0]!.id]);
  });
});
