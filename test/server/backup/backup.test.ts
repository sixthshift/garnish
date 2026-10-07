// Taking and restoring a backup (M40.3, M40.4). The round trip is the check:
// back up database A, restore it into a fresh B that already holds data of its
// own, back up B, and the two backups match but for when they were taken —
// images byte for byte. A restore replaces; it never merges.
import type { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { databasePath, openDatabase } from "../../../src/db/connection/open";
import { seedSample } from "../../../src/db/dev/sample";
import { migrate } from "../../../src/db/migrations/migrate";
import { backupRepository } from "../../../src/db/models/backup/repo";
import { recipeRepository } from "../../../src/db/models/recipe/repo";
import { seed } from "../../../src/db/seed/seed";
import { BACKUP_JSON, type Backup } from "../../../src/domain/backup";
import { readZip, writeZip } from "../../../src/lib/zip";
import { readBackup, restoreBackup } from "../../../src/server/backup/restore";
import { takeBackup } from "../../../src/server/backup/take";
import { IDS, sampleBackup } from "../../helpers/backup";
import { PNG_BYTES } from "../../helpers/zip";

const scratch: { dir: string; db: Database }[] = [];
afterEach(() => {
  for (const { dir, db } of scratch.splice(0)) {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A data directory with a migrated, seeded database, as the server would make it. */
function dataDir(): { dir: string; db: Database } {
  const dir = mkdtempSync(join(tmpdir(), "garnish-backup-"));
  const db = openDatabase(databasePath(dir));
  migrate(db);
  seed(db);
  scratch.push({ dir, db });
  return { dir, db };
}

/** Write a file under the data directory. */
async function put(dir: string, path: string, bytes: Uint8Array): Promise<void> {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  await Bun.write(join(dir, path), bytes);
}

/** A data directory holding the sample backup's rows and its three images. */
async function sampleHousehold(): Promise<{ dir: string; db: Database }> {
  const home = dataDir();
  const { garnish: _, ...body } = sampleBackup();
  backupRepository(home.db).replace(body);
  for (const [i, path] of [`images/${IDS.recipe}.png`, `images/steps/${IDS.step}.png`, `images/timeline/${IDS.event}.png`].entries())
    await put(home.dir, path, new Uint8Array([...PNG_BYTES, i]));
  return home;
}

/** A backup's JSON and its files, read back out of the zip. */
async function unpack(bytes: Uint8Array): Promise<{ json: Backup; files: Map<string, Uint8Array> }> {
  const entries = await readZip(bytes);
  const files = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  return { json: JSON.parse(new TextDecoder().decode(files.get(BACKUP_JSON)!)) as Backup, files };
}

const withoutTakenAt = (json: Backup) => ({ ...json, garnish: { ...json.garnish, createdAt: "" } });

const FIRST = new Date("2026-10-07T09:15:00Z");
const LATER = new Date("2026-10-07T10:30:00Z");

test("what the repository is given it reads back unchanged", async () => {
  const { db } = await sampleHousehold();
  const { garnish: _, ...body } = sampleBackup();
  expect(backupRepository(db).read()).toEqual(body);
});

describe("taking a backup", () => {
  test("holds garnish.json, deflated, and every image beside it", async () => {
    const { dir, db } = await sampleHousehold();
    const taken = await takeBackup(backupRepository(db), dir, FIRST);
    const { json, files } = await unpack(taken.bytes);

    expect(json.garnish).toMatchObject({ format: "garnish-backup", version: 1, createdAt: FIRST.toISOString() });
    expect({ ...json, garnish: null }).toEqual({ ...sampleBackup(), garnish: null });
    expect([...files.keys()]).toEqual([BACKUP_JSON, `images/${IDS.recipe}.png`, `images/steps/${IDS.step}.png`, `images/timeline/${IDS.event}.png`]);
    expect(files.get(`images/steps/${IDS.step}.png`)).toEqual(new Uint8Array([...PNG_BYTES, 1]));
    expect(taken.counts).toMatchObject({ recipes: 1, images: 3 });
    expect(taken.missingImages).toEqual([]);
  });

  test("two backups of one database differ only in when they were taken", async () => {
    const { dir, db } = await sampleHousehold();
    const repo = backupRepository(db);
    const first = await unpack((await takeBackup(repo, dir, FIRST)).bytes);
    const second = await unpack((await takeBackup(repo, dir, LATER)).bytes);
    expect(withoutTakenAt(second.json)).toEqual(withoutTakenAt(first.json));
    expect((await takeBackup(repo, dir, FIRST)).bytes).toEqual((await takeBackup(repo, dir, FIRST)).bytes);
  });

  test("an image the database names but the disk lacks is left out and counted", async () => {
    const { dir, db } = await sampleHousehold();
    rmSync(join(dir, `images/steps/${IDS.step}.png`));
    const taken = await takeBackup(backupRepository(db), dir, FIRST);
    const { json, files } = await unpack(taken.bytes);
    expect(json.recipes[0]!.parts[0]!.steps[0]!.image).toBeNull();
    expect(files.has(`images/steps/${IDS.step}.png`)).toBe(false);
    expect(taken.missingImages).toEqual([`images/steps/${IDS.step}.png`]);
    expect((await readBackup(taken.bytes)).ok).toBe(true);
  });
});

describe("the round trip", () => {
  test("every kind of row and image comes back as it was, and nothing of B survives", async () => {
    const a = await sampleHousehold();
    const backup = await takeBackup(backupRepository(a.db), a.dir, FIRST);

    const b = dataDir();
    seedSample(b.db);
    await put(b.dir, "images/stray.png", PNG_BYTES);
    const restored = await restoreBackup(backupRepository(b.db), b.dir, backup.bytes, LATER);
    expect(restored).toMatchObject({ ok: true, createdAt: FIRST.toISOString(), counts: backup.counts });

    const again = await unpack((await takeBackup(backupRepository(b.db), b.dir, LATER)).bytes);
    const before = await unpack(backup.bytes);
    expect(withoutTakenAt(again.json)).toEqual(withoutTakenAt(before.json));
    const images = (files: Map<string, Uint8Array>) => [...files].filter(([name]) => name !== BACKUP_JSON);
    expect(images(again.files)).toEqual(images(before.files));
    expect(existsSync(join(b.dir, "images/stray.png"))).toBe(false);
    expect(readdirSync(b.dir).filter((name) => name.startsWith("images."))).toEqual([]);
  });

  test("a household made through the repositories comes back as it was, lastMade included", async () => {
    const a = dataDir();
    const sample = seedSample(a.db).recipes;
    const cooked = sample.find((recipe) => recipe.lastMade !== null)!;
    const backup = await takeBackup(backupRepository(a.db), a.dir, FIRST);

    const b = dataDir();
    expect((await restoreBackup(backupRepository(b.db), b.dir, backup.bytes, LATER)).ok).toBe(true);

    const again = await unpack((await takeBackup(backupRepository(b.db), b.dir, LATER)).bytes);
    expect(withoutTakenAt(again.json)).toEqual(withoutTakenAt((await unpack(backup.bytes)).json));
    expect(recipeRepository(b.db).get(cooked.slug)).toEqual(recipeRepository(a.db).get(cooked.slug));
  });

  test("the database and the photos as they were are kept beside each other", async () => {
    const a = await sampleHousehold();
    const backup = await takeBackup(backupRepository(a.db), a.dir, FIRST);
    const b = dataDir();
    seedSample(b.db);
    await put(b.dir, "images/stray.png", PNG_BYTES);
    const restored = await restoreBackup(backupRepository(b.db), b.dir, backup.bytes, LATER);
    expect(restored.ok && restored.snapshot).toBe(join(b.dir, "backups", "garnish-pre-restore-20261007-103000.db"));
    expect(await Bun.file(join(b.dir, "backups", "garnish-pre-restore-20261007-103000-images", "stray.png")).bytes()).toEqual(PNG_BYTES);
    const kept = openDatabase(join(b.dir, "backups", "garnish-pre-restore-20261007-103000.db"));
    try {
      expect(recipeRepository(kept).query({ by: "filter", sort: "name", dir: "asc" }).length).toBeGreaterThan(0);
      expect(recipeRepository(kept).get("hollandaise")).toBeNull();
    } finally {
      kept.close();
    }
  });
});

describe("what is refused, leaving everything as it was", () => {
  async function refused(bytes: Uint8Array): Promise<string[]> {
    const b = dataDir();
    seedSample(b.db);
    await put(b.dir, "images/stray.png", PNG_BYTES);
    const before = backupRepository(b.db).read();
    const result = await restoreBackup(backupRepository(b.db), b.dir, bytes, LATER);
    expect(backupRepository(b.db).read()).toEqual(before);
    expect(existsSync(join(b.dir, "images/stray.png"))).toBe(true);
    expect(existsSync(join(b.dir, "backups"))).toBe(false);
    return result.ok ? [] : result.problems;
  }

  const zipOf = (json: unknown, images: string[] = []) =>
    writeZip([{ name: BACKUP_JSON, bytes: new TextEncoder().encode(JSON.stringify(json)) }, ...images.map((name) => ({ name, bytes: PNG_BYTES }))]);
  const allImages = [`images/${IDS.recipe}.png`, `images/steps/${IDS.step}.png`, `images/timeline/${IDS.event}.png`];

  test("a dangling foodId", async () => {
    const backup = sampleBackup();
    backup.recipes[0]!.parts[0]!.ingredients[0]!.foodId = "99999999-0000-4000-8000-000000000000";
    expect(await refused(await zipOf(backup, allImages))).toEqual([
      "recipes[0].parts[0].ingredients[0].foodId: food 99999999-0000-4000-8000-000000000000 is not in the backup",
    ]);
  });

  test("an image named but not in the zip", async () => {
    expect(await refused(await zipOf(sampleBackup(), allImages.slice(1)))).toEqual([`images/${IDS.recipe}.png is named in garnish.json but is not in the zip`]);
  });

  test("a file that is not a backup", async () => {
    expect(await refused(new TextEncoder().encode("{}"))).toEqual(["This is not a garnish backup: a backup is a .zip file"]);
    expect(await refused(await writeZip([{ name: "database.json", bytes: new TextEncoder().encode("{}") }]))).toEqual([
      "This is not a garnish backup: it has no garnish.json",
    ]);
    expect(await refused(await writeZip([{ name: BACKUP_JSON, bytes: new TextEncoder().encode("{") }]))).toEqual(["garnish.json is not valid JSON"]);
  });
});
