import { type ParsedRecipeInput, recipeInputSchema } from "../domain/recipe";

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
  savedAt: string = new Date().toISOString()
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
