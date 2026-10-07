// The zip reader behind the Mealie import (M34.3): stored and deflated
// entries, directories dropped, and a readable message for anything it cannot
// walk. Archives are built in memory by test/helpers/zip.ts, so there is no
// binary fixture to trust — and since M40.2 they are the app's own writer's,
// so the writer is checked here too, and once by `unzip` where it is installed.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { crc32, findEndOfCentralDirectory, inflate, isZip, readZip, writeZip } from "../../src/lib/zip";
import { makeZip, PNG_BYTES } from "../helpers/zip";

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

describe("writeZip", () => {
  test("crc32 matches the standard check value", () => {
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
  });

  test("what it writes the reader reads back, stored and compressed", async () => {
    const text = utf8("Rub the butter into the flour. ".repeat(50));
    const zip = await writeZip([
      { name: "garnish.json", bytes: text, compress: true },
      { name: "images/steps/crème.png", bytes: PNG_BYTES },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((entry) => entry.name)).toEqual(["garnish.json", "images/steps/crème.png"]);
    expect(entries[0]!.bytes).toEqual(text);
    expect(entries[1]!.bytes).toEqual(PNG_BYTES);
    expect(zip.length).toBeLessThan(text.length);
  });

  test("the same files and date give the same bytes", async () => {
    const files = [{ name: "a.txt", bytes: utf8("a"), compress: true }];
    const at = new Date("2026-10-07T09:15:00Z");
    expect(await writeZip(files, at)).toEqual(await writeZip(files, at));
  });

  test.skipIf(!Bun.which("unzip"))("unzip accepts it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "garnish-zip-"));
    try {
      const path = join(dir, "test.zip");
      await Bun.write(
        path,
        await writeZip([
          { name: "a.txt", bytes: utf8("hello"), compress: true },
          { name: "b.png", bytes: PNG_BYTES },
        ])
      );
      const result = Bun.spawnSync(["unzip", "-t", path]);
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
