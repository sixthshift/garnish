// The step editor's pure helpers, its rendering, and the Check for M5.5: a
// component holding three steps plus two recipe-level steps and two titled
// notes saves through createRecipe and reads back in order; after moveStep
// and moveNote, updateRecipe stores the new orders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { renameComponent } from "../../src/components/ComponentsEditor";
import { addNote, moveNote, updateNote } from "../../src/components/NotesEditor";
import { emptyDraft, type RecipeDraft, validateDraft } from "../../src/components/RecipeForm";
import { addStep, moveStep, newStep, removeStep, StepsEditor, stepsOf, stepsPath, updateStep, withSteps } from "../../src/components/StepsEditor";
import { createRecipe, getRecipe, updateRecipe } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** One component (Dough) with three steps, two recipe-level steps and two titled notes, built with the helpers. */
function focaccia(): RecipeDraft {
  let draft = renameComponent({ ...emptyDraft(), name: "Focaccia" }, 0, "Dough");
  draft = addStep(draft, 0, "Mix.");
  draft = addStep(draft, 0, "Rest.");
  draft = addStep(draft, 0, "Fold.");
  draft = addStep(draft, null, "Dimple.");
  draft = addStep(draft, null, "Bake.");
  draft = updateNote(addNote(draft), 0, { title: "Flour", text: "Bread flour, not plain." });
  draft = updateNote(addNote(draft), 1, { title: "Timing", text: "Overnight in the fridge is better." });
  return draft;
}

const texts = (draft: RecipeDraft, ci: number | null) => stepsOf(draft, ci)!.map((step) => step.text);

describe("newStep, stepsOf, withSteps, stepsPath", () => {
  test("a new step is blank with a fresh uuid", () => {
    const step = newStep();
    expect(step.text).toBe("");
    expect(step.id).toMatch(UUID);
    expect(newStep("Mix.").text).toBe("Mix.");
    expect(newStep().id).not.toBe(step.id);
  });

  test("stepsOf picks the component's steps, or the recipe's for null, or undefined out of range", () => {
    const draft = focaccia();
    expect(stepsOf(draft, 0)).toBe(draft.components[0]!.steps);
    expect(stepsOf(draft, null)).toBe(draft.steps);
    expect(stepsOf(draft, 1)).toBeUndefined();
    expect(stepsOf(draft, -1)).toBeUndefined();
  });

  test("withSteps replaces only the named array and leaves the original alone", () => {
    const draft = focaccia();
    const inComponent = withSteps(draft, 0, [newStep("Only.")]);
    expect(texts(inComponent, 0)).toEqual(["Only."]);
    expect(texts(inComponent, null)).toEqual(["Dimple.", "Bake."]);
    const atRecipe = withSteps(draft, null, []);
    expect(atRecipe.steps).toEqual([]);
    expect(texts(atRecipe, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(texts(draft, null)).toEqual(["Dimple.", "Bake."]);
    expect(withSteps(draft, 5, [newStep()])).toEqual(draft);
  });

  test("stepsPath names the field prefix", () => {
    expect(stepsPath(0)).toBe("components.0.steps");
    expect(stepsPath(2)).toBe("components.2.steps");
    expect(stepsPath(null)).toBe("steps");
  });
});

describe("addStep", () => {
  test("appends to the component or the recipe, keeping the other lists", () => {
    const draft = focaccia();
    const next = addStep(draft, 0);
    expect(texts(next, 0)).toEqual(["Mix.", "Rest.", "Fold.", ""]);
    expect(next.components[0]!.steps[3]!.id).toMatch(UUID);
    expect(texts(next, null)).toEqual(["Dimple.", "Bake."]);
    expect(texts(addStep(draft, null, "Cool."), null)).toEqual(["Dimple.", "Bake.", "Cool."]);
    expect(texts(draft, 0)).toHaveLength(3);
  });

  test("an out-of-range component returns an unchanged copy", () => {
    const draft = focaccia();
    const next = addStep(draft, 3);
    expect(next).toEqual(draft);
    expect(next).not.toBe(draft);
  });

  test("the result still validates", () => {
    expect(validateDraft(addStep(addStep(focaccia(), 0), null)).ok).toBe(true);
  });
});

describe("updateStep", () => {
  test("changes only the indexed step's text, keeping its id", () => {
    const draft = focaccia();
    const id = draft.components[0]!.steps[1]!.id;
    const next = updateStep(draft, 0, 1, "Rest an hour.");
    expect(texts(next, 0)).toEqual(["Mix.", "Rest an hour.", "Fold."]);
    expect(next.components[0]!.steps[1]!.id).toBe(id);
    expect(texts(updateStep(draft, null, 0, "Dimple deeply."), null)).toEqual(["Dimple deeply.", "Bake."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = focaccia();
    expect(updateStep(draft, 0, 3, "x")).toEqual(draft);
    expect(updateStep(draft, 0, -1, "x")).toEqual(draft);
    expect(updateStep(draft, 2, 0, "x")).toEqual(draft);
    expect(updateStep(draft, null, 2, "x")).toEqual(draft);
  });
});

describe("removeStep", () => {
  test("drops the indexed step from the named list", () => {
    const draft = focaccia();
    expect(texts(removeStep(draft, 0, 1), 0)).toEqual(["Mix.", "Fold."]);
    expect(texts(removeStep(draft, null, 0), null)).toEqual(["Bake."]);
    expect(texts(draft, 0)).toHaveLength(3);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = focaccia();
    expect(removeStep(draft, 0, 3)).toEqual(draft);
    expect(removeStep(draft, 4, 0)).toEqual(draft);
    expect(removeStep(draft, null, -1)).toEqual(draft);
  });
});

describe("moveStep", () => {
  test("moves within the named list and leaves the original alone", () => {
    const draft = focaccia();
    expect(texts(moveStep(draft, 0, 2, 0), 0)).toEqual(["Fold.", "Mix.", "Rest."]);
    expect(texts(moveStep(draft, 0, 0, 1), 0)).toEqual(["Rest.", "Mix.", "Fold."]);
    expect(texts(moveStep(draft, null, 0, 1), null)).toEqual(["Bake.", "Dimple."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("out-of-range, same index or missing component is a copy in the original order", () => {
    const draft = focaccia();
    expect(moveStep(draft, 0, 0, 0)).toEqual(draft);
    expect(moveStep(draft, 0, 0, 3)).toEqual(draft);
    expect(moveStep(draft, null, 5, 0)).toEqual(draft);
    expect(moveStep(draft, 7, 0, 1)).toEqual(draft);
  });
});

describe("StepsEditor", () => {
  test("renders a numbered textarea per step, in order, with reorder and remove controls", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} ci={0} onChange={() => {}} />);
    expect(html).toContain(">Steps<");
    expect(html).toContain(">Add step<");
    expect(html).toMatch(/<textarea[^>]*name="components\.0\.steps\.0\.text"[^>]*>Mix\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="components\.0\.steps\.1\.text"[^>]*>Rest\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="components\.0\.steps\.2\.text"[^>]*>Fold\.<\/textarea>/);
    expect(html.indexOf("Mix.")).toBeLessThan(html.indexOf("Rest."));
    expect(html.indexOf("Rest.")).toBeLessThan(html.indexOf("Fold."));
    expect(html).toContain('aria-label="Step 1"');
    expect(html).toContain('aria-label="Step 3"');
    expect(html.match(/aria-label="Move step \d up"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Move step \d down"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Remove step \d"/g)).toHaveLength(3);
    // Recipe-level steps are not part of a component's editor.
    expect(html).not.toContain("Dimple.");
  });

  test("ci null edits the recipe's own steps under a caller-chosen heading", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} ci={null} heading="To finish" onChange={() => {}} />);
    expect(html).toContain(">To finish<");
    expect(html).toMatch(/<textarea[^>]*name="steps\.0\.text"[^>]*>Dimple\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="steps\.1\.text"[^>]*>Bake\.<\/textarea>/);
    expect(html).not.toContain("Mix.");
  });

  test("an empty list says so; disabled disables the textareas and the add button; errors show inline", () => {
    const empty = renderToString(<StepsEditor draft={emptyDraft()} ci={0} onChange={() => {}} />);
    expect(empty).toContain("No steps yet");
    expect(empty).not.toContain("<textarea");

    const disabled = renderToString(<StepsEditor draft={focaccia()} ci={0} onChange={() => {}} disabled />);
    expect(disabled).toMatch(/<textarea[^>]*disabled=""[^>]*name="components\.0\.steps\.0\.text"|<textarea[^>]*name="components\.0\.steps\.0\.text"[^>]*disabled=""/);
    expect(disabled).toMatch(/<button[^>]*disabled=""[^>]*>Add step</);

    const withError = renderToString(<StepsEditor draft={focaccia()} ci={0} onChange={() => {}} errors={{ "components.0.steps.1.text": "Too long" }} />);
    expect(withError).toContain('role="alert"');
    expect(withError).toContain("Too long");
    expect(withError.match(/aria-invalid="true"/g)).toHaveLength(1);
  });

  test("an out-of-range component renders nothing", () => {
    expect(renderToString(<StepsEditor draft={focaccia()} ci={4} onChange={() => {}} />)).toBe("");
  });
});

describe("Check: saved step and note order matches the draft", () => {
  test("create, read back, move a step and a note, update, read back", async () => {
    const draft = focaccia();
    const parsed = validateDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await callServerFn(createRecipe, parsed.data);
    let fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.components.map((c) => c.name)).toEqual(["Dough"]);
    expect(fetched.components[0]!.steps.map((s) => s.text)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(fetched.steps.map((s) => s.text)).toEqual(["Dimple.", "Bake."]);
    expect(fetched.notes.map((n) => n.title)).toEqual(["Flour", "Timing"]);
    expect(fetched.notes.map((n) => n.text)).toEqual(["Bread flour, not plain.", "Overnight in the fridge is better."]);
    // Client ids survive, so rows keep their keys after save.
    expect(fetched.components[0]!.steps.map((s) => s.id)).toEqual(draft.components[0]!.steps.map((s) => s.id));
    expect(fetched.steps.map((s) => s.id)).toEqual(draft.steps.map((s) => s.id));
    expect(fetched.notes.map((n) => n.id)).toEqual(draft.notes.map((n) => n.id));

    // Reorder: last component step to the front, recipe steps swapped, notes swapped.
    let moved = moveStep({ ...draft, id: created.id }, 0, 2, 0);
    moved = moveStep(moved, null, 0, 1);
    moved = moveNote(moved, 1, 0);
    const reordered = validateDraft(moved);
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    const updated = await callServerFn(updateRecipe, { id: created.id, doc: reordered.data });
    expect(updated.components[0]!.steps.map((s) => s.text)).toEqual(["Fold.", "Mix.", "Rest."]);

    fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.components[0]!.steps.map((s) => s.text)).toEqual(["Fold.", "Mix.", "Rest."]);
    expect(fetched.steps.map((s) => s.text)).toEqual(["Bake.", "Dimple."]);
    expect(fetched.notes.map((n) => n.title)).toEqual(["Timing", "Flour"]);
    expect(fetched.notes.map((n) => n.text)).toEqual(["Overnight in the fridge is better.", "Bread flour, not plain."]);
  });
});
