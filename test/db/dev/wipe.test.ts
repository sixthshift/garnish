// Wiping DATA_DIR: takes the database, its sidecars and the images, leaves
// everything else.
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { DB_FILE } from "../../../src/db/connection/open";
import { wipeDataDir } from "../../../src/db/dev/wipe";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "garnish-wipe-"));
});

test("removes the database, both sidecars and the images directory", async () => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) await Bun.write(join(dir, file), "x");
  mkdirSync(join(dir, "images"));
  await Bun.write(join(dir, "images", "a.png"), "x");

  const { removed } = wipeDataDir(dir);

  expect(removed.sort()).toEqual([DB_FILE, `${DB_FILE}-shm`, `${DB_FILE}-wal`, "images"].sort());
  for (const target of removed) expect(existsSync(join(dir, target))).toBe(false);
});

test("leaves backups and anything else alone", async () => {
  await Bun.write(join(dir, DB_FILE), "x");
  mkdirSync(join(dir, "backups"));
  await Bun.write(join(dir, "backups", "garnish-20260101-000000.db"), "x");
  await Bun.write(join(dir, "notes.txt"), "x");

  wipeDataDir(dir);

  expect(existsSync(join(dir, "backups", "garnish-20260101-000000.db"))).toBe(true);
  expect(existsSync(join(dir, "notes.txt"))).toBe(true);
});

test("a directory with nothing in it is not an error", () => {
  expect(wipeDataDir(dir)).toEqual({ removed: [] });
  // And the directory itself survives, so the next migrate has somewhere to go.
  expect(existsSync(dir)).toBe(true);
});
