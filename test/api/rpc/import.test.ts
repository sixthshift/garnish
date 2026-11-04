// The import's server functions: the validators. The availability flag is
// test/api/rpc/ai.test.ts.
// The importer behind them is tested in test/domain/recipes/import; the wiring in
// test/server/import.
import { describe, expect, test } from "vitest";
import { ImportFromTextInput, ImportFromUrlInput, importFromText, urlImportLog } from "../../../src/api/rpc/import";
import { ImportError, type ImportedRecipe } from "../../../src/domain/recipes/import";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

describe("the import server functions", () => {
  test("a blank paste is refused by the validator, before any request is made", async () => {
    await expect(callServerFn(importFromText, { text: "   " } as never)).rejects.toThrow(/too_small|at least 1/);
    expect(ImportFromTextInput.parse({ text: " hi " })).toEqual({ text: "hi", sourceUrl: "" });
  });

  test("the anchor is optional, and validated through the scraped schema when it is there", () => {
    const parsed = ImportFromTextInput.parse({ text: "hi", anchor: { name: "Anzac biscuits", parts: [{ ingredients: ["1 cup plain flour"] }] } });
    expect(parsed.anchor?.parts[0]?.ingredients).toEqual(["1 cup plain flour"]);
    expect(() => ImportFromTextInput.parse({ text: "hi", anchor: { parts: [] } })).toThrow();
  });

  test("a blank address is refused by the validator", () => {
    expect(() => ImportFromUrlInput.parse({ url: "  " })).toThrow();
    expect(ImportFromUrlInput.parse({ url: " https://example.test/x " })).toEqual({ url: "https://example.test/x" });
  });
});

describe("urlImportLog (decisions.md row 202)", () => {
  const result = (via?: "fetch" | "render") =>
    ({ from: "schema", url: "https://example.test/x", recipe: { name: "Anzac biscuits" }, pageText: "", via }) as unknown as ImportedRecipe;

  test("a read names the host, the way and the seconds, and warns of nothing", () => {
    expect(urlImportLog("https://www.coles.com.au/r", { result: result("render") }, 4.26)).toEqual({
      note: { name: "import", host: "www.coles.com.au", via: "render", seconds: 4.3 },
      warning: null,
    });
    expect(urlImportLog("https://example.test/x", { result: result() }, 0.1).note.via).toBe("fetch");
  });

  test("a failure is a note with its message; only a walled-off site is a warning", () => {
    const notFound = urlImportLog("https://example.test/x", { error: new ImportError("failed", "example.test returned 404") }, 0.5);
    expect(notFound.note).toMatchObject({ via: "none", message: "example.test returned 404" });
    expect(notFound.warning).toBeNull();

    const walled = urlImportLog("https://www.taste.com.au/r", { error: new ImportError("blocked", "Couldn't get this recipe from www.taste.com.au.") }, 6);
    expect(walled.warning).toMatchObject({ level: "warning", name: "import", message: "Every way of reading www.taste.com.au was walled off" });
  });

  test("an address that is not one is logged as typed", () => {
    expect(urlImportLog("not a url", { error: new ImportError("failed", "Enter an http or https address") }, 0).note.host).toBe("not a url");
  });
});
