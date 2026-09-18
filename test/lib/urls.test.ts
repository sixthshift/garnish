// What a share sheet hands /recipes/new: the address may be in any of the
// three manifest fields, whole or inside a sentence.
import { describe, expect, test } from "vitest";
import { sharedUrl } from "../../src/lib/urls";

describe("sharedUrl", () => {
  test("a clean url field wins", () => {
    expect(sharedUrl({ url: "https://example.test/a", text: "https://example.test/b" })).toBe("https://example.test/a");
  });

  test("Android's browser share puts the address in text, and the title carries none", () => {
    expect(sharedUrl({ title: "Anzac biscuits", text: "https://example.test/anzac" })).toBe("https://example.test/anzac");
  });

  test("an address inside a sentence is picked out, trailing punctuation dropped", () => {
    expect(sharedUrl({ text: "Look at this: https://example.test/anzac?x=1. So good" })).toBe("https://example.test/anzac?x=1");
  });

  test("whitespace around a whole address is trimmed", () => {
    expect(sharedUrl({ url: "  https://example.test/a \n" })).toBe("https://example.test/a");
  });

  test("no http(s) address anywhere is null", () => {
    expect(sharedUrl({ title: "Anzac biscuits", text: "Chewy and golden." })).toBeNull();
    expect(sharedUrl({ url: "ftp://example.test/a" })).toBeNull();
    expect(sharedUrl({})).toBeNull();
  });
});
