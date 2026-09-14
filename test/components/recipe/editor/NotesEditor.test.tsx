// The notes editor's pure helpers and its rendering. The save-and-reload
// Check for notes lives with the steps in StepsEditor.test.tsx.
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { addNote, moveNote, newNote, NotesEditor, removeNote, updateNote } from "../../../../src/components/recipe/editor/NotesEditor";
import { emptyDraft, type RecipeDraft, validateDraft } from "../../../../src/components/recipe/editor/RecipeForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A named draft with two titled notes, built with the helpers. */
function withNotes(): RecipeDraft {
  let draft = { ...emptyDraft(), name: "Focaccia" };
  draft = updateNote(addNote(draft), 0, { title: "Flour", text: "Bread flour, not plain." });
  draft = updateNote(addNote(draft), 1, { title: "Timing", text: "Overnight is better." });
  return draft;
}

const titles = (draft: RecipeDraft) => draft.notes.map((note) => note.title);

describe("newNote and addNote", () => {
  test("a new note is blank with a fresh uuid", () => {
    const note = newNote();
    expect(note).toMatchObject({ title: "", text: "" });
    expect(note.id).toMatch(UUID);
    expect(newNote().id).not.toBe(note.id);
  });

  test("appends without touching the original draft", () => {
    const draft = withNotes();
    const next = addNote(draft);
    expect(next.notes).toHaveLength(3);
    expect(next.notes[2]).toMatchObject({ title: "", text: "" });
    expect(draft.notes).toHaveLength(2);
  });

  test("the result still validates", () => {
    expect(validateDraft(addNote(withNotes())).ok).toBe(true);
  });
});

describe("updateNote", () => {
  test("merges the patch into only the indexed note, keeping its id", () => {
    const draft = withNotes();
    const id = draft.notes[1]!.id;
    const next = updateNote(draft, 1, { text: "Overnight in the fridge." });
    expect(next.notes[1]).toEqual({ id, title: "Timing", text: "Overnight in the fridge." });
    expect(next.notes[0]).toEqual(draft.notes[0]);
    expect(draft.notes[1]!.text).toBe("Overnight is better.");
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = withNotes();
    expect(updateNote(draft, 2, { title: "x" })).toEqual(draft);
    expect(updateNote(draft, -1, { title: "x" })).toEqual(draft);
    expect(updateNote(draft, 2, { title: "x" })).not.toBe(draft);
  });
});

describe("removeNote", () => {
  test("drops the indexed note", () => {
    const draft = withNotes();
    expect(titles(removeNote(draft, 0))).toEqual(["Timing"]);
    expect(titles(removeNote(draft, 1))).toEqual(["Flour"]);
    expect(titles(draft)).toEqual(["Flour", "Timing"]);
  });

  test("an out-of-range index returns an unchanged copy", () => {
    const draft = withNotes();
    expect(removeNote(draft, 2)).toEqual(draft);
    expect(removeNote(draft, -1)).toEqual(draft);
  });
});

describe("moveNote", () => {
  test("swaps two notes and leaves the original alone", () => {
    const draft = withNotes();
    expect(titles(moveNote(draft, 0, 1))).toEqual(["Timing", "Flour"]);
    expect(titles(moveNote(draft, 1, 0))).toEqual(["Timing", "Flour"]);
    expect(titles(draft)).toEqual(["Flour", "Timing"]);
  });

  test("out-of-range or same index is a copy in the original order", () => {
    const draft = withNotes();
    expect(moveNote(draft, 0, 0)).toEqual(draft);
    expect(moveNote(draft, 0, 2)).toEqual(draft);
    expect(moveNote(draft, -1, 0)).toEqual(draft);
  });
});

describe("NotesEditor", () => {
  test("renders a title input and a textarea per note, in order, with reorder and remove controls", () => {
    const html = renderToString(<NotesEditor draft={withNotes()} onChange={() => {}} />);
    expect(html).toContain('aria-label="Notes"');
    expect(html).toContain(">Notes<");
    expect(html).toContain(">Add note<");
    expect(html).toMatch(/<input[^>]*name="notes\.0\.title"[^>]*value="Flour"/);
    expect(html).toMatch(/<input[^>]*name="notes\.1\.title"[^>]*value="Timing"/);
    expect(html).toMatch(/<textarea[^>]*name="notes\.0\.text"[^>]*>Bread flour, not plain\.<\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*name="notes\.1\.text"[^>]*>Overnight is better\.<\/textarea>/);
    expect(html.indexOf('value="Flour"')).toBeLessThan(html.indexOf('value="Timing"'));
    expect(html).toContain('aria-label="Note 1 title"');
    expect(html).toContain('aria-label="Note 2 text"');
    expect(html.match(/aria-label="Move note \d up"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Move note \d down"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Remove note \d"/g)).toHaveLength(2);
  });

  test("an empty list says so; disabled disables the inputs and the add button; errors show inline", () => {
    const empty = renderToString(<NotesEditor draft={emptyDraft()} onChange={() => {}} />);
    expect(empty).toContain("No notes yet");
    expect(empty).not.toContain("<textarea");

    const disabled = renderToString(<NotesEditor draft={withNotes()} onChange={() => {}} disabled />);
    expect(disabled).toMatch(/<input[^>]*name="notes\.0\.title"[^>]*disabled=""|<input[^>]*disabled=""[^>]*name="notes\.0\.title"/);
    expect(disabled).toMatch(/<button[^>]*disabled=""[^>]*>Add note</);

    const withError = renderToString(<NotesEditor draft={withNotes()} onChange={() => {}} errors={{ "notes.1.text": "Too long" }} />);
    expect(withError).toContain('role="alert"');
    expect(withError).toContain("Too long");
    expect(withError.match(/aria-invalid="true"/g)).toHaveLength(1);
  });
});
