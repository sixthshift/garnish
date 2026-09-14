// Editing a draft's notes.
import { randomUuid } from "../../ids";
import { type DraftNote, type RecipeDraft } from "./types";
import { moveItem } from "../../lists";

/** A blank note with a fresh id, so it has a stable row key before it is saved. */
export function newNote(): DraftNote {
  return { id: randomUuid(), title: "", text: "" };
}

/** The draft with a blank note appended. Pure apart from the note's id. */
export function addNote(draft: RecipeDraft): RecipeDraft {
  return { ...draft, notes: [...draft.notes, newNote()] };
}

/** The draft with `patch` merged into note `ni`. An out-of-range index returns a copy unchanged. Pure. */
export function updateNote(draft: RecipeDraft, ni: number, patch: Partial<DraftNote>): RecipeDraft {
  if (ni < 0 || ni >= draft.notes.length) return { ...draft, notes: draft.notes.slice() };
  return { ...draft, notes: draft.notes.map((note, i) => (i === ni ? { ...note, ...patch } : note)) };
}

/** The draft without note `ni`. An out-of-range index returns a copy unchanged. Pure. */
export function removeNote(draft: RecipeDraft, ni: number): RecipeDraft {
  if (ni < 0 || ni >= draft.notes.length) return { ...draft, notes: draft.notes.slice() };
  return { ...draft, notes: draft.notes.filter((_, i) => i !== ni) };
}

/** The draft with note `from` moved to `to`. Same rules as `moveItem`. Pure. */
export function moveNote(draft: RecipeDraft, from: number, to: number): RecipeDraft {
  return { ...draft, notes: moveItem(draft.notes, from, to) };
}
