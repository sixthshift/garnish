// The zip reader behind the Mealie import (M34.3): stored and deflated
// entries, directories dropped, and a readable message for anything it cannot
// walk. Archives are built in memory by test/helpers/zip.ts, so there is no
// binary fixture to trust.
import { describe, expect, test } from "vitest";
import { findEndOfCentralDirectory, inflate, isZip, readZip } from "../../../../src/domain/import/sources/zip";
import { makeZip, PNG_BYTES } from "../../../helpers/zip";

const utf8 = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

test("isZip reads the magic bytes", async () => {
  expect(isZip(await makeZip([{ name: "a.txt", bytes: utf8("a") }]))).toBe(true);
  expect(isZip(utf8("{}"))).toBe(false);
  expect(isZip(new Uint8Array())).toBe(false);
});

test("a stored entry comes back byte for byte", async () => {
  const zip = await makeZip([{ name: "database.json", bytes: utf8('{"recipes":[]}') }]);
  const entries = await readZip(zip);
  expect(entries).toHaveLength(1);
  expect(entries[0]!.name).toBe("database.json");
  expect(decode(entries[0]!.bytes)).toBe('{"recipes":[]}');
});

test("a deflated entry is inflated, and binary survives", async () => {
  const text = "Rub the butter into the flour. ".repeat(50);
  const zip = await makeZip([
    { name: "data/recipes/abc/recipe.json", bytes: utf8(text), deflate: true },
    { name: "data/recipes/abc/images/original.png", bytes: PNG_BYTES },
  ]);
  const entries = await readZip(zip);
  expect(entries.map((entry) => entry.name)).toEqual(["data/recipes/abc/recipe.json", "data/recipes/abc/images/original.png"]);
  expect(decode(entries[0]!.bytes)).toBe(text);
  expect([...entries[1]!.bytes]).toEqual([...PNG_BYTES]);
});

test("directory entries are dropped", async () => {
  const zip = await makeZip([
    { name: "data/", bytes: new Uint8Array() },
    { name: "data/one.json", bytes: utf8("1") },
  ]);
  expect((await readZip(zip)).map((entry) => entry.name)).toEqual(["data/one.json"]);
});

test("an empty archive reads as no entries", async () => {
  expect(await readZip(await makeZip([]))).toEqual([]);
});

describe("what it refuses", () => {
  test("bytes that are not a zip", async () => {
    await expect(readZip(utf8("{}"))).rejects.toThrow("not a zip");
    await expect(readZip(utf8("x".repeat(100)))).rejects.toThrow("not a zip");
  });

  test("a truncated archive", async () => {
    const zip = await makeZip([{ name: "a.txt", bytes: utf8("hello") }]);
    // Keep the directory but cut the data out from under it.
    const damaged = zip.slice();
    const view = new DataView(damaged.buffer);
    view.setUint32(view.byteLength - 6, 0xffffff00, true);
    await expect(readZip(damaged)).rejects.toThrow(/damaged|truncated/);
  });

  test("a compression method it does not know", async () => {
    await expect(inflate(utf8("x"), 12)).rejects.toThrow("unsupported compression method");
  });
});

test("findEndOfCentralDirectory finds the record even behind a comment", async () => {
  const zip = await makeZip([{ name: "a.txt", bytes: utf8("a") }]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  expect(findEndOfCentralDirectory(view)).toBe(zip.byteLength - 22);
  expect(findEndOfCentralDirectory(new DataView(utf8("x".repeat(40)).buffer))).toBe(-1);
});
