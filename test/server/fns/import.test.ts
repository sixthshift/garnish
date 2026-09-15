// The import's server functions: the availability flag and the validators.
// The importer behind them is tested in test/domain/import; the wiring in
// test/server/import.
import { afterEach, describe, expect, test } from "vitest";
import { aiImportAvailable, ImportFromTextInput, ImportFromUrlInput, importFromText } from "../../../src/server/fns/import";
import { callServerFn, useTempDataDir } from "../../helpers/server";

useTempDataDir();

const saved = process.env.AI_API_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = saved;
});

describe("the import server functions", () => {
  test("an unset key hides the option and a set one shows it", async () => {
    delete process.env.AI_API_KEY;
    await expect(callServerFn(aiImportAvailable)).resolves.toEqual({ available: false });
    process.env.AI_API_KEY = "k";
    await expect(callServerFn(aiImportAvailable)).resolves.toEqual({ available: true });
  });

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
