// The draft store against an in-memory storage, including one that throws on
// every access. The store is the whole of M27.4's persistence: the form holds
// the draft in state and calls these three functions, so a save clearing the
// key is a `clearDraft` call and is asserted here.
import { describe, expect, test } from "vitest";
import { clearDraft, draftKey, draftNoticeText, formatSavedAt, getDraft, putDraft, type StorageLike } from "../../src/lib/drafts";

/** A plain in-memory Storage-like, for round-trip tests. */
function memoryStorage(): StorageLike & { size: () => number; raw: (key: string) => string | null } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    size: () => map.size,
    raw: (key) => map.get(key) ?? null,
  };
}

/** A storage whose every method throws, for the "storage is unavailable" cases. */
function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
    removeItem: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  };
}

const recipeId = "11111111-1111-4111-8111-111111111111";

/** The least document that parses, as the form's draft shape. */
function draft(overrides: Record<string, unknown> = {}) {
  return { name: "Lemon tart", parts: [{ name: "", ingredients: [], steps: [] }], ...overrides };
}

describe("draftKey", () => {
  test("one key per recipe, and a shared one for a recipe with no id", () => {
    expect(draftKey(recipeId)).toBe(`garnish.draft.${recipeId}`);
    expect(draftKey()).toBe("garnish.draft.new");
    expect(draftKey(null)).toBe("garnish.draft.new");
    expect(draftKey("")).toBe("garnish.draft.new");
  });
});

describe("putDraft / getDraft", () => {
  test("round-trips the document, when it was written and whether an image was picked", () => {
    const storage = memoryStorage();
    putDraft(storage, recipeId, draft({ description: "Sharp." }), true, "2026-09-11T05:04:00.000Z");
    const stored = getDraft(storage, recipeId);
    expect(stored?.savedAt).toBe("2026-09-11T05:04:00.000Z");
    expect(stored?.hadImage).toBe(true);
    expect(stored?.draft.name).toBe("Lemon tart");
    expect(stored?.draft.description).toBe("Sharp.");
    expect(stored?.draft.parts).toHaveLength(1);
  });

  test("the stamps are not part of the document that comes back", () => {
    const storage = memoryStorage();
    putDraft(storage, null, draft(), false, "2026-09-11T05:04:00.000Z");
    const stored = getDraft(storage, null);
    expect(stored?.draft).not.toHaveProperty("savedAt");
    expect(stored?.draft).not.toHaveProperty("hadImage");
  });

  test("stamps itself when no time is given", () => {
    const storage = memoryStorage();
    const before = Date.now();
    putDraft(storage, recipeId, draft(), false);
    const at = new Date(getDraft(storage, recipeId)?.savedAt ?? "").getTime();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  test("a new recipe and an existing one do not share a key", () => {
    const storage = memoryStorage();
    putDraft(storage, undefined, draft({ name: "New one" }), false);
    putDraft(storage, recipeId, draft({ name: "The stored one" }), false);
    expect(getDraft(storage, undefined)?.draft.name).toBe("New one");
    expect(getDraft(storage, recipeId)?.draft.name).toBe("The stored one");
  });

  test("nothing stored is no draft", () => {
    expect(getDraft(memoryStorage(), recipeId)).toBeNull();
  });

  test("malformed content is no draft", () => {
    const storage = memoryStorage();
    storage.setItem(draftKey(recipeId), "not json{");
    expect(getDraft(storage, recipeId)).toBeNull();
    storage.setItem(draftKey(recipeId), JSON.stringify("a string"));
    expect(getDraft(storage, recipeId)).toBeNull();
  });

  test("a document that no longer parses is discarded", () => {
    const storage = memoryStorage();
    storage.setItem(draftKey(recipeId), JSON.stringify({ name: "", parts: [], savedAt: "2026-09-11T05:04:00.000Z", hadImage: false }));
    expect(getDraft(storage, recipeId)).toBeNull();
  });

  test("a draft without a stamp is discarded", () => {
    const storage = memoryStorage();
    storage.setItem(draftKey(recipeId), JSON.stringify(draft()));
    expect(getDraft(storage, recipeId)).toBeNull();
  });

  test("a throwing storage means no draft and no write", () => {
    const storage = throwingStorage();
    expect(() => putDraft(storage, recipeId, draft(), false)).not.toThrow();
    expect(getDraft(storage, recipeId)).toBeNull();
  });
});

describe("clearDraft", () => {
  test("forgets that recipe's draft and leaves the others alone", () => {
    const storage = memoryStorage();
    putDraft(storage, recipeId, draft(), false);
    putDraft(storage, undefined, draft({ name: "New one" }), false);
    clearDraft(storage, recipeId);
    expect(getDraft(storage, recipeId)).toBeNull();
    expect(storage.raw(draftKey(recipeId))).toBeNull();
    expect(getDraft(storage, undefined)?.draft.name).toBe("New one");
  });

  test("a save clears the key: what the form calls once the recipe is stored", () => {
    const storage = memoryStorage();
    putDraft(storage, undefined, draft(), true);
    expect(storage.size()).toBe(1);
    clearDraft(storage, undefined);
    expect(storage.size()).toBe(0);
    expect(getDraft(storage, undefined)).toBeNull();
  });

  test("clearing nothing, or clearing through a throwing storage, is quiet", () => {
    expect(() => clearDraft(memoryStorage(), recipeId)).not.toThrow();
    expect(() => clearDraft(throwingStorage(), recipeId)).not.toThrow();
  });
});

describe("formatSavedAt", () => {
  test("an en-AU day and time", () => {
    const text = formatSavedAt("2026-09-11T05:04:00.000Z");
    expect(text).toMatch(/\d{1,2} \w{3}/);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });

  test("an unparseable stamp formats to nothing", () => {
    expect(formatSavedAt("not a date")).toBe("");
    expect(formatSavedAt("")).toBe("");
  });
});

describe("draftNoticeText", () => {
  test("says when the draft was written", () => {
    const text = draftNoticeText({ savedAt: "2026-09-11T05:04:00.000Z", hadImage: false });
    expect(text).toContain("You have unsaved changes from ");
    expect(text).not.toContain("picture");
  });

  test("says the picture was not kept when one had been chosen", () => {
    const text = draftNoticeText({ savedAt: "2026-09-11T05:04:00.000Z", hadImage: true });
    expect(text).toContain("The picture you chose was not kept; pick it again.");
  });

  test("drops the time when the stamp does not parse", () => {
    expect(draftNoticeText({ savedAt: "rubbish", hadImage: false })).toBe("You have unsaved changes.");
  });
});
