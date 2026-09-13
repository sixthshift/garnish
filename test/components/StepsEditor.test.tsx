// The step editor's pure helpers, its rendering, and the Check for M5.5: a
// named part holding three steps plus an unnamed part holding two and two
// titled notes saves through createRecipe and reads back in order; after
// moveStep and moveNote, updateRecipe stores the new orders.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { addPart, renamePart } from "../../src/components/PartsEditor";
import { addNote, moveNote, updateNote } from "../../src/components/NotesEditor";
import { emptyDraft, type RecipeDraft, validateDraft } from "../../src/components/RecipeForm";
import {
  addBulkSteps,
  addStep,
  canSplitAll,
  insertStepAbove,
  insertStepBelow,
  mergeAllSteps,
  mergeStepWithNext,
  moveStep,
  newStep,
  linkableIngredients,
  linkedIngredients,
  linkIngredient,
  removeStep,
  setStepImage,
  splitAllSteps,
  splitStepByParagraph,
  StepsEditor,
  stepLinks,
  stepsOf,
  stepsPath,
  suggestNotice,
  suggestPartLinks,
  unionLinks,
  unlinkIngredient,
  unlinkStepIngredient,
  updateStep,
  withSteps,
} from "../../src/components/StepsEditor";
import { addIngredient, foodReference, updateIngredient } from "../../src/components/IngredientsEditor";
import { ingredientLine } from "../../src/components/PartsEditor";
import { paragraphs } from "../../src/domain/bulkText";
import { createRecipe, getRecipe, updateRecipe } from "../../src/server/recipes";
import { callServerFn, useTempDataDir } from "../helpers/server";

useTempDataDir();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Two parts — Dough with three steps, the unnamed main body with two — and two titled notes, built with the helpers. */
function focaccia(): RecipeDraft {
  let draft = renamePart({ ...emptyDraft(), name: "Focaccia" }, 0, "Dough");
  draft = addStep(draft, 0, "Mix.");
  draft = addStep(draft, 0, "Rest.");
  draft = addStep(draft, 0, "Fold.");
  draft = addPart(draft);
  draft = addStep(draft, 1, "Dimple.");
  draft = addStep(draft, 1, "Bake.");
  draft = updateNote(addNote(draft), 0, { title: "Flour", text: "Bread flour, not plain." });
  draft = updateNote(addNote(draft), 1, { title: "Timing", text: "Overnight in the fridge is better." });
  return draft;
}

const texts = (draft: RecipeDraft, pi: number) => stepsOf(draft, pi)!.map((step) => step.text);

/** The opening tag of the control carrying `label`. */
function tagWithLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${label}"[^>]*>`));
  if (!match) throw new Error(`no control labelled ${label}`);
  return match[0];
}

describe("newStep, stepsOf, withSteps, stepsPath", () => {
  test("a new step is blank with a fresh uuid", () => {
    const step = newStep();
    expect(step.text).toBe("");
    expect(step.id).toMatch(UUID);
    expect(newStep("Mix.").text).toBe("Mix.");
    expect(newStep().id).not.toBe(step.id);
  });

  test("stepsOf picks that part's steps, or undefined out of range", () => {
    const draft = focaccia();
    expect(stepsOf(draft, 0)).toBe(draft.parts[0]!.steps);
    expect(stepsOf(draft, 1)).toBe(draft.parts[1]!.steps);
    expect(stepsOf(draft, 2)).toBeUndefined();
    expect(stepsOf(draft, -1)).toBeUndefined();
  });

  test("withSteps replaces only the named array and leaves the original alone", () => {
    const draft = focaccia();
    const inDough = withSteps(draft, 0, [newStep("Only.")]);
    expect(texts(inDough, 0)).toEqual(["Only."]);
    expect(texts(inDough, 1)).toEqual(["Dimple.", "Bake."]);
    const cleared = withSteps(draft, 1, []);
    expect(texts(cleared, 1)).toEqual([]);
    expect(texts(cleared, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(texts(draft, 1)).toEqual(["Dimple.", "Bake."]);
    expect(withSteps(draft, 5, [newStep()])).toEqual(draft);
  });

  test("stepsPath names the field prefix", () => {
    expect(stepsPath(0)).toBe("parts.0.steps");
    expect(stepsPath(2)).toBe("parts.2.steps");
  });
});

describe("addStep", () => {
  test("appends to the component or the recipe, keeping the other lists", () => {
    const draft = focaccia();
    const next = addStep(draft, 0);
    expect(texts(next, 0)).toEqual(["Mix.", "Rest.", "Fold.", ""]);
    expect(next.parts[0]!.steps[3]!.id).toMatch(UUID);
    expect(texts(next, 1)).toEqual(["Dimple.", "Bake."]);
    expect(texts(addStep(draft, 1, "Cool."), 1)).toEqual(["Dimple.", "Bake.", "Cool."]);
    expect(texts(draft, 0)).toHaveLength(3);
  });

  test("an out-of-range component returns an unchanged copy", () => {
    const draft = focaccia();
    const next = addStep(draft, 3);
    expect(next).toEqual(draft);
    expect(next).not.toBe(draft);
  });

  test("the result still validates", () => {
    expect(validateDraft(addStep(addStep(focaccia(), 0), 1)).ok).toBe(true);
  });
});

describe("updateStep", () => {
  test("changes only the indexed step's text, keeping its id", () => {
    const draft = focaccia();
    const id = draft.parts[0]!.steps[1]!.id;
    const next = updateStep(draft, 0, 1, "Rest an hour.");
    expect(texts(next, 0)).toEqual(["Mix.", "Rest an hour.", "Fold."]);
    expect(next.parts[0]!.steps[1]!.id).toBe(id);
    expect(texts(updateStep(draft, 1, 0, "Dimple deeply."), 1)).toEqual(["Dimple deeply.", "Bake."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = focaccia();
    expect(updateStep(draft, 0, 3, "x")).toEqual(draft);
    expect(updateStep(draft, 0, -1, "x")).toEqual(draft);
    expect(updateStep(draft, 2, 0, "x")).toEqual(draft);
    expect(updateStep(draft, 1, 2, "x")).toEqual(draft);
  });
});

describe("removeStep", () => {
  test("drops the indexed step from the named list", () => {
    const draft = focaccia();
    expect(texts(removeStep(draft, 0, 1), 0)).toEqual(["Mix.", "Fold."]);
    expect(texts(removeStep(draft, 1, 0), 1)).toEqual(["Bake."]);
    expect(texts(draft, 0)).toHaveLength(3);
  });

  test("out-of-range indices return an unchanged copy", () => {
    const draft = focaccia();
    expect(removeStep(draft, 0, 3)).toEqual(draft);
    expect(removeStep(draft, 4, 0)).toEqual(draft);
    expect(removeStep(draft, 1, -1)).toEqual(draft);
  });
});

describe("moveStep", () => {
  test("moves within the named list and leaves the original alone", () => {
    const draft = focaccia();
    expect(texts(moveStep(draft, 0, 2, 0), 0)).toEqual(["Fold.", "Mix.", "Rest."]);
    expect(texts(moveStep(draft, 0, 0, 1), 0)).toEqual(["Rest.", "Mix.", "Fold."]);
    expect(texts(moveStep(draft, 1, 0, 1), 1)).toEqual(["Bake.", "Dimple."]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("out-of-range, same index or missing component is a copy in the original order", () => {
    const draft = focaccia();
    expect(moveStep(draft, 0, 0, 0)).toEqual(draft);
    expect(moveStep(draft, 0, 0, 3)).toEqual(draft);
    expect(moveStep(draft, 1, 5, 0)).toEqual(draft);
    expect(moveStep(draft, 7, 0, 1)).toEqual(draft);
  });
});

describe("addBulkSteps", () => {
  test("appends one step per line, in order, to the named list only", () => {
    const draft = focaccia();
    const next = addBulkSteps(draft, 0, ["Shape.", "Prove."]);
    expect(texts(next, 0)).toEqual(["Mix.", "Rest.", "Fold.", "Shape.", "Prove."]);
    expect(next.parts[0]!.steps[4]!.id).toMatch(UUID);
    expect(texts(next, 1)).toEqual(["Dimple.", "Bake."]);
    expect(texts(addBulkSteps(draft, 1, ["Cool."]), 1)).toEqual(["Dimple.", "Bake.", "Cool."]);
    expect(texts(draft, 0)).toHaveLength(3);
  });

  test("no lines, or an out-of-range component, returns an unchanged copy", () => {
    const draft = focaccia();
    for (const next of [addBulkSteps(draft, 0, []), addBulkSteps(draft, 3, ["x"])]) {
      expect(next).toEqual(draft);
      expect(next).not.toBe(draft);
    }
  });
});

describe("insertStepAbove and insertStepBelow", () => {
  test("insert a blank step before, or after, the named index, keeping the rest in order", () => {
    const draft = focaccia();
    expect(texts(insertStepAbove(draft, 0, 1), 0)).toEqual(["Mix.", "", "Rest.", "Fold."]);
    expect(texts(insertStepBelow(draft, 0, 1), 0)).toEqual(["Mix.", "Rest.", "", "Fold."]);
    expect(texts(insertStepAbove(draft, 1, 0), 1)).toEqual(["", "Dimple.", "Bake."]);
    expect(texts(insertStepBelow(draft, 1, 1), 1)).toEqual(["Dimple.", "Bake.", ""]);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("the new step has a fresh id", () => {
    const next = insertStepAbove(focaccia(), 0, 0);
    expect(next.parts[0]!.steps[0]!.id).toMatch(UUID);
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = focaccia();
    for (const next of [insertStepAbove(draft, 0, 3), insertStepAbove(draft, 0, -1), insertStepBelow(draft, 0, 3), insertStepBelow(draft, 5, 0)]) {
      expect(next).toEqual(draft);
      expect(next).not.toBe(draft);
    }
  });
});

describe("splitStepByParagraph", () => {
  test("replaces a multi-paragraph step with one step per paragraph, at the same position", () => {
    const draft = updateStep(focaccia(), 0, 1, "Cover the bowl.\n\nLeave it somewhere warm\nfor an hour.");
    const next = splitStepByParagraph(draft, 0, 1);
    expect(texts(next, 0)).toEqual(["Mix.", "Cover the bowl.", "Leave it somewhere warm for an hour.", "Fold."]);
    expect(next.parts[0]!.steps[1]!.id).toMatch(UUID);
    expect(next.parts[0]!.steps[2]!.id).toMatch(UUID);
  });

  test("a step with one paragraph, or none, is unaffected", () => {
    const draft = focaccia();
    expect(splitStepByParagraph(draft, 0, 0)).toEqual(draft);
    const blank = updateStep(draft, 0, 0, "   ");
    expect(splitStepByParagraph(blank, 0, 0)).toEqual(blank);
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = focaccia();
    expect(splitStepByParagraph(draft, 0, 9)).toEqual(draft);
    expect(splitStepByParagraph(draft, 9, 0)).toEqual(draft);
  });
});

describe("mergeStepWithNext", () => {
  test("joins a step's text with the next step's, kept at the first step's id, and drops the next", () => {
    const draft = focaccia();
    const id = draft.parts[0]!.steps[0]!.id;
    const next = mergeStepWithNext(draft, 0, 0);
    expect(texts(next, 0)).toEqual(["Mix.\n\nRest.", "Fold."]);
    expect(next.parts[0]!.steps[0]!.id).toBe(id);
    expect(texts(draft, 0)).toEqual(["Mix.", "Rest.", "Fold."]);
  });

  test("the last step has nothing to merge with and is unaffected", () => {
    const draft = focaccia();
    expect(mergeStepWithNext(draft, 0, 2)).toEqual(draft);
    expect(mergeStepWithNext(draft, 1, 1)).toEqual(draft);
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = focaccia();
    expect(mergeStepWithNext(draft, 0, 9)).toEqual(draft);
    expect(mergeStepWithNext(draft, 9, 0)).toEqual(draft);
  });
});

describe("setStepImage (M35.1)", () => {
  test("points one step at the stored file, leaving its text, links and siblings alone", () => {
    const draft = linkIngredient(focaccia(), 0, 0, focaccia().parts[0]!.steps[0]!.id!);
    const next = setStepImage(draft, 0, 1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg");
    expect(next.parts[0]!.steps[1]!.image).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg");
    expect(next.parts[0]!.steps[1]!.text).toBe(draft.parts[0]!.steps[1]!.text);
    expect(next.parts[0]!.steps[0]).toEqual(draft.parts[0]!.steps[0]);
    expect(next.parts[0]!.steps[2]).toEqual(draft.parts[0]!.steps[2]);
    expect(draft.parts[0]!.steps[1]!.image).toBeUndefined();
  });

  test("null drops the photo from the document", () => {
    const withPhoto = setStepImage(focaccia(), 0, 0, "a.jpg");
    expect(setStepImage(withPhoto, 0, 0, null).parts[0]!.steps[0]!.image).toBeNull();
  });

  test("an out-of-range index changes nothing", () => {
    const draft = focaccia();
    expect(setStepImage(draft, 0, 9, "a.jpg")).toEqual(draft);
    expect(setStepImage(draft, 0, -1, "a.jpg")).toEqual(draft);
    expect(setStepImage(draft, 9, 0, "a.jpg")).toEqual(draft);
  });
});

describe("StepsEditor", () => {
  // M35.1: the row menu's "Add image" opens a hidden file input per row. The
  // menu itself is closed in a server render (the test above says so), so what
  // is observable here is the input it clicks and the thumbnail of a stored one.
  test("every step row carries a hidden image picker, and a stored photo shows as a thumbnail", () => {
    const bare = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(bare.match(/type="file"/g)).toHaveLength(3);
    expect(bare).toContain('aria-label="Step 1 image"');
    expect(bare).toContain('aria-label="Step 3 image"');
    expect(bare).not.toContain("data-step-image");

    const withPhoto = renderToString(<StepsEditor draft={setStepImage(focaccia(), 0, 1, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png")} pi={0} onChange={() => {}} />);
    expect(withPhoto).toContain('data-step-image="1"');
    expect(withPhoto).toContain('src="/api/images/steps/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png"');
    expect(withPhoto).toContain('alt="Step 2"');
  });

  test("a disabled editor disables the image pickers too", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} disabled />);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
  });

  test("has a Bulk add button beside Add step, and the sheet is closed by default", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html).toContain(">Bulk add<");
    expect(html).toContain(">Add step<");
    expect(html).not.toContain('role="dialog"');
  });

  test("every step opens editing, with Preview only in its menu (M22.1)", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    // Three textareas, no preview panes, and the toggle is behind the menu.
    expect(html.match(/<textarea/g)).toHaveLength(3);
    expect(html).not.toContain("data-step-preview");
    expect(html).not.toContain(">Preview<");
    expect(html).not.toContain('data-testid="markdown"');
  });

  test("a previewed step renders markdown while the rest stay editable (M22.1)", () => {
    const draft = updateStep(focaccia(), 0, 1, "Rest, then **fold**.");
    const id = draft.parts[0]!.steps[1]!.id!;
    const html = renderToString(<StepsEditor draft={draft} pi={0} onChange={() => {}} previewSteps={[id]} />);
    expect(html).toContain('data-step-preview="1"');
    expect(html).toContain('data-testid="markdown"');
    expect(html).toContain("<strong");
    expect(html).toContain("fold");
    // Only that one: the other two are still textareas.
    expect(html.match(/<textarea/g)).toHaveLength(2);
    expect(html).not.toContain('name="parts.0.steps.1.text"');
    expect(html).toContain('name="parts.0.steps.0.text"');
    expect(html).toContain('name="parts.0.steps.2.text"');
  });

  test("a blank step previews as nothing rather than an empty box", () => {
    const draft = withSteps(emptyDraft(), 0, [newStep("  ")]);
    const html = renderToString(<StepsEditor draft={draft} pi={0} onChange={() => {}} previewSteps={[draft.parts[0]!.steps[0]!.id!]} />);
    expect(html).toContain("Nothing to preview");
    expect(html).not.toContain('data-testid="markdown"');
  });

  test("each step has one actions menu, not a row of buttons (M21.2)", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html.match(/aria-label="Step \d actions"/g)).toHaveLength(3);
    // The four inline tools are gone; the menu holds them, closed until asked.
    expect(html).not.toContain("Insert above");
    expect(html).not.toContain("Insert below");
    expect(html).not.toContain("Split by paragraph");
    expect(html).not.toContain("Merge with next");
    expect(html).not.toContain('role="menu"');
  });

  test("split all and merge all sit once in the header, disabled when they would do nothing", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html).toContain(">Split all<");
    expect(html).toContain(">Merge all<");
    // No step has two paragraphs, so Split all has nothing to do.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Split all</);
    // Three steps, so Merge all does.
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Merge all</);

    const split = renderToString(<StepsEditor draft={updateStep(focaccia(), 0, 0, "Mix.\n\nKnead.")} pi={0} onChange={() => {}} />);
    expect(split).not.toMatch(/<button[^>]*disabled=""[^>]*>Split all</);

    const one = renderToString(<StepsEditor draft={withSteps(emptyDraft(), 0, [newStep("Only one.")])} pi={0} onChange={() => {}} />);
    expect(one).toMatch(/<button[^>]*disabled=""[^>]*>Merge all</);
  });

  test("renders a numbered textarea per step, in order, with reorder and remove controls", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html).toContain(">Steps<");
    expect(html).toContain(">Add step<");
    expect(html).toMatch(/<textarea[^>]*name="parts\.0\.steps\.0\.text"[^>]*>Mix\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="parts\.0\.steps\.1\.text"[^>]*>Rest\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="parts\.0\.steps\.2\.text"[^>]*>Fold\.<\/textarea>/);
    expect(html.indexOf("Mix.")).toBeLessThan(html.indexOf("Rest."));
    expect(html.indexOf("Rest.")).toBeLessThan(html.indexOf("Fold."));
    expect(html).toContain('aria-label="Step 1"');
    expect(html).toContain('aria-label="Step 3"');
    expect(html.match(/aria-label="Move step \d up"/g)).toHaveLength(3);
    expect(html.match(/aria-label="Move step \d down"/g)).toHaveLength(3);
    // Delete moved into the row's menu (M21.2), so the list has no remove button.
    expect(html).not.toContain('aria-label="Remove step 1"');
    // Recipe-level steps are not part of a component's editor.
    expect(html).not.toContain("Dimple.");
  });

  test("a second part's steps render under a caller-chosen heading", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={1} heading="To finish" onChange={() => {}} />);
    expect(html).toContain(">To finish<");
    expect(html).toMatch(/<textarea[^>]*name="parts\.1\.steps\.0\.text"[^>]*>Dimple\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="parts\.1\.steps\.1\.text"[^>]*>Bake\.<\/textarea>/);
    expect(html).not.toContain("Mix.");
  });

  test("disabled disables the textareas and the add button; errors show inline", () => {
    const disabled = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} disabled />);
    expect(disabled).toMatch(/<textarea[^>]*disabled=""[^>]*name="parts\.0\.steps\.0\.text"|<textarea[^>]*name="parts\.0\.steps\.0\.text"[^>]*disabled=""/);
    expect(disabled).toMatch(/<button[^>]*disabled=""[^>]*>Add step</);

    const withError = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} errors={{ "parts.0.steps.1.text": "Too long" }} />);
    expect(withError).toContain('role="alert"');
    expect(withError).toContain("Too long");
    expect(withError.match(/aria-invalid="true"/g)).toHaveLength(1);
  });

  test("an out-of-range component renders nothing", () => {
    expect(renderToString(<StepsEditor draft={focaccia()} pi={4} onChange={() => {}} />)).toBe("");
  });
});

// M27.3: entry is text first, same as the ingredients side (M27.2). An empty
// list is a textarea inviting the whole method, and its Add lands one step
// per paragraph, not per line.
describe("Text-first steps (M27.3)", () => {
  test("empty: the list renders a textarea, the method placeholder, and no step row", () => {
    const html = renderToString(<StepsEditor draft={emptyDraft()} pi={0} onChange={() => {}} />);
    expect(html).not.toContain("No steps yet");
    expect(html).toContain('aria-label="New steps"');
    expect(html).toContain("The method, a blank line between steps");
    expect(html).toContain(">Add<");
    expect(html).not.toContain('aria-label="Step 1"');
    expect(html).not.toContain('name="parts.0.steps.0.text"');
    // Bulk add and Add step stay in the header, same as a populated list.
    expect(html).toContain(">Bulk add<");
    expect(html).toContain(">Add step<");
  });

  test("populated: the textarea is gone and the step rows are back", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html).not.toContain("The method, a blank line between steps");
    expect(html).not.toContain('aria-label="New steps"');
    expect(html).toContain('aria-label="Step 1"');
  });

  test("a paste of three paragraphs through the inline Add lands three steps", () => {
    // The exact wiring the empty state's `BulkInlineAdd` runs: `paragraphs`
    // splits the pasted text, `addBulkSteps` appends one step per line.
    const pasted = "Mix the dry ingredients.\n\nFold in the wet ingredients\nuntil just combined.\n\nBake for 40 minutes.";
    const lines = paragraphs(pasted);
    expect(lines).toHaveLength(3);
    const next = addBulkSteps(emptyDraft(), 0, lines);
    expect(texts(next, 0)).toEqual(["Mix the dry ingredients.", "Fold in the wet ingredients until just combined.", "Bake for 40 minutes."]);
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
    expect(fetched.parts.map((c) => c.name)).toEqual(["Dough", ""]);
    expect(fetched.parts[0]!.steps.map((s) => s.text)).toEqual(["Mix.", "Rest.", "Fold."]);
    expect(fetched.parts[1]!.steps.map((s) => s.text)).toEqual(["Dimple.", "Bake."]);
    expect(fetched.notes.map((n) => n.title)).toEqual(["Flour", "Timing"]);
    expect(fetched.notes.map((n) => n.text)).toEqual(["Bread flour, not plain.", "Overnight in the fridge is better."]);
    // Client ids survive, so rows keep their keys after save.
    expect(fetched.parts[0]!.steps.map((s) => s.id)).toEqual(draft.parts[0]!.steps.map((s) => s.id));
    expect(fetched.parts[1]!.steps.map((s) => s.id)).toEqual(draft.parts[1]!.steps.map((s) => s.id));
    expect(fetched.notes.map((n) => n.id)).toEqual(draft.notes.map((n) => n.id));

    // Reorder: Dough's last step to the front, the unnamed part's two swapped, notes swapped.
    let moved = moveStep({ ...draft, id: created.id }, 0, 2, 0);
    moved = moveStep(moved, 1, 0, 1);
    moved = moveNote(moved, 1, 0);
    const reordered = validateDraft(moved);
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    const updated = await callServerFn(updateRecipe, { id: created.id, doc: reordered.data });
    expect(updated.parts[0]!.steps.map((s) => s.text)).toEqual(["Fold.", "Mix.", "Rest."]);

    fetched = await callServerFn(getRecipe, { slug: created.slug });
    expect(fetched.parts[0]!.steps.map((s) => s.text)).toEqual(["Fold.", "Mix.", "Rest."]);
    expect(fetched.parts[1]!.steps.map((s) => s.text)).toEqual(["Bake.", "Dimple."]);
    expect(fetched.notes.map((n) => n.title)).toEqual(["Timing", "Flour"]);
    expect(fetched.notes.map((n) => n.text)).toEqual(["Overnight in the fridge is better.", "Bread flour, not plain."]);
  });
});

describe("splitAllSteps, mergeAllSteps and canSplitAll (M21.2)", () => {
  test("canSplitAll is true only when some step holds more than one paragraph", () => {
    expect(canSplitAll(focaccia().parts[0]!.steps)).toBe(false);
    expect(canSplitAll(updateStep(focaccia(), 0, 0, "Mix.\n\nKnead.").parts[0]!.steps)).toBe(true);
  });

  test("split all splits every multi-paragraph step and leaves the rest alone", () => {
    const draft = updateStep(focaccia(), 0, 1, "Rest.\n\nCover it.");
    const next = splitAllSteps(draft, 0);
    expect(next.parts[0]!.steps.map((step) => step.text)).toEqual(["Mix.", "Rest.", "Cover it.", "Fold."]);
    // The step that was split keeps its id on the first chunk.
    expect(next.parts[0]!.steps[1]!.id).toBe(draft.parts[0]!.steps[1]!.id);
  });

  test("split all with nothing to split is an unchanged copy", () => {
    const draft = focaccia();
    const next = splitAllSteps(draft, 0);
    expect(next.parts[0]!.steps).toEqual(draft.parts[0]!.steps);
    expect(next).not.toBe(draft);
  });

  test("merge all joins the list into one step on the first step's id", () => {
    const draft = focaccia();
    const next = mergeAllSteps(draft, 0);
    expect(next.parts[0]!.steps).toHaveLength(1);
    expect(next.parts[0]!.steps[0]!.text).toBe("Mix.\n\nRest.\n\nFold.");
    expect(next.parts[0]!.steps[0]!.id).toBe(draft.parts[0]!.steps[0]!.id);
    // The other part is untouched.
    expect(next.parts[1]).toEqual(draft.parts[1]);
  });

  test("merge all with fewer than two steps, or an out-of-range part, is an unchanged copy", () => {
    const one = withSteps(emptyDraft(), 0, [newStep("Only one.")]);
    expect(mergeAllSteps(one, 0).parts[0]!.steps).toEqual(one.parts[0]!.steps);
    const draft = focaccia();
    expect(mergeAllSteps(draft, 9).parts).toEqual(draft.parts);
    expect(splitAllSteps(draft, 9).parts).toEqual(draft.parts);
  });

  test("merge all drops blank steps rather than leaving blank lines", () => {
    const draft = withSteps(emptyDraft(), 0, [newStep("Mix."), newStep("  "), newStep("Bake.")]);
    expect(mergeAllSteps(draft, 0).parts[0]!.steps[0]!.text).toBe("Mix.\n\nBake.");
  });
});

// --- Ingredient links (M28.3) ----------------------------------------------

/** One part: three ingredients (flour, butter, water) and three steps, the first already linked to flour. */
function pastry(): RecipeDraft {
  let draft: RecipeDraft = { ...emptyDraft(), name: "Pastry" };
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 0, { quantity: 200, food: foodReference({ name: "flour" }) });
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 1, { quantity: 100, food: foodReference({ name: "butter" }) });
  draft = addIngredient(draft, 0);
  draft = updateIngredient(draft, 0, 2, { quantity: 2, food: foodReference({ name: "water" }) });
  draft = addStep(draft, 0, "Rub the butter into the flour.");
  draft = addStep(draft, 0, "Add the water.");
  draft = addStep(draft, 0, "Rest it.");
  return draft;
}

const rowIds = (draft: RecipeDraft) => draft.parts[0]!.ingredients.map((row) => row.id!);
const links = (draft: RecipeDraft, pi = 0) => draft.parts[pi]!.steps.map((step) => stepLinks(step));

describe("stepLinks, unionLinks and newStep's links", () => {
  test("a new step starts with no links", () => {
    expect(newStep("Mix.").ingredientIds).toEqual([]);
  });

  test("stepLinks reads a missing array as none", () => {
    expect(stepLinks({ id: "x", text: "Mix." })).toEqual([]);
    expect(stepLinks({ id: "x", text: "Mix.", ingredientIds: ["a"] })).toEqual(["a"]);
  });

  test("unionLinks keeps step order then link order, each id once", () => {
    const steps = [
      { id: "1", text: "", ingredientIds: ["a", "b"] },
      { id: "2", text: "" },
      { id: "3", text: "", ingredientIds: ["b", "c"] },
    ];
    expect(unionLinks(steps)).toEqual(["a", "b", "c"]);
  });
});

describe("linkedIngredients and linkableIngredients", () => {
  test("linked rows come back in link order, and a link naming no row is skipped", () => {
    const draft = pastry();
    const [flour, butter] = rowIds(draft);
    const part = draft.parts[0]!;
    const step = { id: "s", text: "", ingredientIds: [butter!, flour!, "gone"] };
    expect(linkedIngredients(part, step).map((row) => row.food?.name)).toEqual(["butter", "flour"]);
  });

  test("a row already linked is not offered again", () => {
    const draft = pastry();
    const [flour] = rowIds(draft);
    const part = draft.parts[0]!;
    expect(linkableIngredients(part, { id: "s", text: "" }).map((row) => row.food?.name)).toEqual(["flour", "butter", "water"]);
    expect(linkableIngredients(part, { id: "s", text: "", ingredientIds: [flour!] }).map((row) => row.food?.name)).toEqual(["butter", "water"]);
  });
});

describe("linkIngredient and unlinkStepIngredient", () => {
  test("linking appends to that step only, in the order picked", () => {
    const draft = pastry();
    const [flour, butter] = rowIds(draft);
    const next = linkIngredient(linkIngredient(draft, 0, 0, butter!), 0, 0, flour!);
    expect(links(next)).toEqual([[butter, flour], [], []]);
  });

  test("linking a row twice, or an out-of-range step, is an unchanged copy", () => {
    const base = pastry();
    const draft = linkIngredient(base, 0, 1, rowIds(base)[0]!);
    const [flour] = rowIds(draft);
    expect(links(linkIngredient(draft, 0, 1, flour!))).toEqual(links(draft));
    expect(linkIngredient(draft, 0, 9, flour!).parts).toEqual(draft.parts);
    expect(linkIngredient(draft, 9, 0, flour!).parts).toEqual(draft.parts);
  });

  test("unlinking removes one chip and leaves the rest", () => {
    const draft = pastry();
    const [flour, butter] = rowIds(draft);
    const linkedDraft = linkIngredient(linkIngredient(draft, 0, 0, flour!), 0, 0, butter!);
    expect(links(unlinkStepIngredient(linkedDraft, 0, 0, flour!))).toEqual([[butter], [], []]);
    expect(unlinkStepIngredient(linkedDraft, 0, 9, flour!).parts).toEqual(linkedDraft.parts);
  });
});

describe("unlinkIngredient", () => {
  test("strips the id from every step of the part", () => {
    const draft = pastry();
    const [flour, butter] = rowIds(draft);
    let linkedDraft = linkIngredient(draft, 0, 0, flour!);
    linkedDraft = linkIngredient(linkedDraft, 0, 0, butter!);
    linkedDraft = linkIngredient(linkedDraft, 0, 2, flour!);
    const part = unlinkIngredient(linkedDraft.parts[0]!, flour!);
    expect(part.steps.map((step) => stepLinks(step))).toEqual([[butter], [], []]);
  });

  test("a part that never linked it comes back as it was", () => {
    const part = pastry().parts[0]!;
    expect(unlinkIngredient(part, "nobody")).toBe(part);
  });
});

describe("suggestPartLinks and suggestNotice", () => {
  test("fills only the steps with no links, and counts them", () => {
    const draft = pastry();
    const [flour, butter, water] = rowIds(draft);
    // Step 1 is already linked to water by hand, though its text names butter and flour.
    const seeded = linkIngredient(draft, 0, 0, water!);
    const suggested = suggestPartLinks(seeded, 0);
    expect(links(suggested.draft)).toEqual([[water], [water], []]);
    expect(suggested.filled).toBe(1);

    const fresh = suggestPartLinks(draft, 0);
    expect(links(fresh.draft)).toEqual([[flour, butter], [water], []]);
    expect(fresh.filled).toBe(2);
  });

  test("an out-of-range part fills nothing", () => {
    const draft = pastry();
    const suggested = suggestPartLinks(draft, 9);
    expect(suggested.filled).toBe(0);
    expect(suggested.draft.parts).toEqual(draft.parts);
  });

  test("says how many it linked", () => {
    expect(suggestNotice(0)).toBe("Nothing to link");
    expect(suggestNotice(1)).toBe("Linked 1 step");
    expect(suggestNotice(3)).toBe("Linked 3 steps");
  });
});

describe("split and merge decide what happens to links (M28.3)", () => {
  test("split keeps the links on the first chunk and starts the rest empty", () => {
    const base = updateStep(pastry(), 0, 0, "Rub the butter in.\n\nAdd flour.");
    const draft = linkIngredient(base, 0, 0, rowIds(base)[0]!);
    const linked = stepLinks(draft.parts[0]!.steps[0]!);
    const next = splitStepByParagraph(draft, 0, 0);
    expect(next.parts[0]!.steps.map((step) => stepLinks(step))).toEqual([linked, [], [], []]);
  });

  test("split all does the same for every step it splits", () => {
    let draft = updateStep(pastry(), 0, 1, "Add the water.\n\nBring it together.");
    const [flour, water] = rowIds(draft);
    draft = linkIngredient(draft, 0, 0, flour!);
    draft = linkIngredient(draft, 0, 1, water!);
    expect(links(splitAllSteps(draft, 0))).toEqual([[flour], [water], [], []]);
  });

  test("merge with next unions the two steps' links, in order", () => {
    let draft = pastry();
    const [flour, butter, water] = rowIds(draft);
    draft = linkIngredient(draft, 0, 0, butter!);
    draft = linkIngredient(draft, 0, 0, flour!);
    draft = linkIngredient(draft, 0, 1, water!);
    draft = linkIngredient(draft, 0, 1, flour!);
    expect(links(mergeStepWithNext(draft, 0, 0))).toEqual([[butter, flour, water], []]);
  });

  test("merge all unions every step's links, in order", () => {
    let draft = pastry();
    const [flour, butter, water] = rowIds(draft);
    draft = linkIngredient(draft, 0, 1, water!);
    draft = linkIngredient(draft, 0, 2, butter!);
    draft = linkIngredient(draft, 0, 2, flour!);
    expect(links(mergeAllSteps(draft, 0))).toEqual([[water, butter, flour]]);
  });
});

describe("StepsEditor ingredient picker (M28.3)", () => {
  test("every step gets an Ingredients combobox over the part's rows, closed on the server", () => {
    const html = renderToString(<StepsEditor draft={pastry()} pi={0} onChange={() => {}} />);
    expect(html.match(/aria-label="Step \d ingredients"/g)).toHaveLength(3);
    expect(tagWithLabel(html, "Step 1 ingredients")).toContain('role="combobox"');
    expect(html).not.toContain('role="listbox"');
  });

  test("a linked row shows as a chip with a remove button under the textarea", () => {
    const draft = pastry();
    const [flour, butter] = rowIds(draft);
    const line = ingredientLine(draft.parts[0]!.ingredients[0]!);
    const linkedDraft = linkIngredient(linkIngredient(draft, 0, 0, flour!), 0, 0, butter!);
    const html = renderToString(<StepsEditor draft={linkedDraft} pi={0} onChange={() => {}} />);
    expect(html).toContain('data-step-links="0"');
    expect(html).toContain(line);
    expect(html).toContain(`aria-label="Unlink ${line} from step 1"`);
    // Only the step that links anything gets a chip row.
    expect(html).not.toContain('data-step-links="1"');
  });

  test("a step linking every row of the part is offered no picker", () => {
    let draft = pastry();
    for (const id of rowIds(draft)) draft = linkIngredient(draft, 0, 0, id);
    const html = renderToString(<StepsEditor draft={draft} pi={0} onChange={() => {}} />);
    expect(html).not.toContain('aria-label="Step 1 ingredients"');
    expect(html).toContain('aria-label="Step 2 ingredients"');
  });

  test("a part with no ingredients has no picker and cannot suggest", () => {
    const html = renderToString(<StepsEditor draft={focaccia()} pi={0} onChange={() => {}} />);
    expect(html).not.toContain("ingredients");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Suggest links</);
  });

  test("Suggest links sits in the header beside Split all", () => {
    const html = renderToString(<StepsEditor draft={pastry()} pi={0} onChange={() => {}} />);
    expect(html).toContain(">Suggest links<");
    expect(html.indexOf(">Suggest links<")).toBeLessThan(html.indexOf(">Split all<"));
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Suggest links</);
  });
});
