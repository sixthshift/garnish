import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { DEFAULT_DATA_DIR, dataDir, ensureDataDir } from "../../../src/server/core/boot";

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("dataDir defaults to ./data", () => {
  expect(dataDir({})).toBe(resolve(DEFAULT_DATA_DIR));
  expect(dataDir({ DATA_DIR: "" })).toBe(resolve(DEFAULT_DATA_DIR));
});

test("dataDir honours DATA_DIR", () => {
  expect(dataDir({ DATA_DIR: "/var/lib/garnish" })).toBe("/var/lib/garnish");
  expect(dataDir({ DATA_DIR: "rel/data" })).toBe(resolve("rel/data"));
});

test("ensureDataDir creates a missing directory, nested, and is idempotent", () => {
  const base = mkdtempSync(join(tmpdir(), "garnish-boot-"));
  scratch.push(base);
  const target = join(base, "a", "b", "data");
  expect(existsSync(target)).toBe(false);

  expect(ensureDataDir(target)).toBe(target);
  expect(statSync(target).isDirectory()).toBe(true);

  expect(ensureDataDir(target)).toBe(target);
  expect(statSync(target).isDirectory()).toBe(true);
});
