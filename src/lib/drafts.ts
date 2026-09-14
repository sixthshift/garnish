// The editor's unsaved draft, kept in `localStorage` so a closed tab, a
// reload or a phone that swapped the app out does not lose what was typed.
//
// Same shape as prefs.ts and ticks.ts: a pure controller over a storage-like
// interface, try/catch around every access, so it unit tests without a DOM
// (including a storage that throws). There are no hooks here — the only reader
// is `RecipeForm`, which holds the draft in state already and takes a
// `storage` prop so the same controller can be driven from a test.
//
// One key per recipe (`garnish.draft.<id>`), and `garnish.draft.new` for a
// recipe that does not exist yet. The new key is shared by every route that
// opens a blank editor, imported or manual: there is only one "new recipe" at
// a time, and a draft saved from one of them is worth offering in the other.
//
// The stored value is the draft's own JSON plus `savedAt` and `hadImage`, and
// it is validated on read with `recipeInputSchema` — the same schema Save
// parses with. A draft written by an older shape of the document therefore
// simply does not come back, which is the right answer: resuming into fields
// the form no longer has is worse than losing the draft.
//
// The picked image file is not stored. It is a `File` handle, not JSON, and
// nothing survives the reload it would need to survive; `hadImage` records
// that there was one so the notice can say to pick it again.
import { type ParsedRecipeInput, recipeInputSchema } from "../domain/recipe/recipe";

/** The slice of `Storage` the controller uses. */
export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** A draft as it comes back off the storage: the parsed document, when it was written, and whether an image had been picked. */
export type StoredDraft = {
  draft: ParsedRecipeInput;
  savedAt: string;
  hadImage: boolean;
};

/** The key one recipe's draft lives under; a new recipe (no id) uses the shared `new` key. Pure. */
export function draftKey(recipeId?: string | null): string {
  return `garnish.draft.${recipeId == null || recipeId === "" ? "new" : recipeId}`;
}

/**
 * The draft stored for `recipeId`, or null when there is none, the storage
 * throws, the value is not JSON, or the document no longer parses.
 */
export function getDraft(storage: StorageLike, recipeId?: string | null): StoredDraft | null {
  let parsed: unknown;
  try {
    const raw = storage.getItem(draftKey(recipeId));
    if (raw == null) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { savedAt, hadImage } = parsed as Record<string, unknown>;
  if (typeof savedAt !== "string") return null;
  // Unknown keys (savedAt, hadImage) are stripped by the schema, so the flat
  // stored object parses straight back into the document.
  const result = recipeInputSchema.safeParse(parsed);
  if (!result.success) return null;
  return { draft: result.data, savedAt, hadImage: hadImage === true };
}

/**
 * Write `draft` as the stored draft for `recipeId`. `savedAt` is injectable so
 * the write is a pure function of its arguments. A throwing storage (full,
 * disabled, private mode) just means the draft does not survive.
 */
export function putDraft(
  storage: StorageLike,
  recipeId: string | null | undefined,
  draft: unknown,
  hadImage: boolean,
  savedAt: string = new Date().toISOString(),
): void {
  try {
    storage.setItem(draftKey(recipeId), JSON.stringify({ ...(draft as object), savedAt, hadImage }));
  } catch {
    // ignored: see above
  }
}

/** Forget the stored draft for `recipeId`. Called on a save and on a confirmed discard. */
export function clearDraft(storage: StorageLike, recipeId?: string | null): void {
  try {
    storage.removeItem(draftKey(recipeId));
  } catch {
    // ignored: a storage that cannot be written to has nothing in it either
  }
}

/** When the draft was written, the way en-AU writes it ("11 Sep, 3:04 pm"). Empty for an unparseable stamp. Pure. */
export function formatSavedAt(savedAt: string): string {
  const at = new Date(savedAt);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(at);
}

/** What the resume notice says: when the draft was written, and that its picture was not kept. Pure. */
export function draftNoticeText(stored: { savedAt: string; hadImage: boolean }): string {
  const when = formatSavedAt(stored.savedAt);
  const line = when === "" ? "You have unsaved changes." : `You have unsaved changes from ${when}.`;
  return stored.hadImage ? `${line} The picture you chose was not kept; pick it again.` : line;
}

/** `window.localStorage`, or undefined on the server and where it is unavailable. */
export function browserStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
