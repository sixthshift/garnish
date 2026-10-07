import { join } from "node:path";
import type { BackupBody, BackupRepository } from "../../db/models/backup/repo";
import { BACKUP_FORMAT, BACKUP_JSON, BACKUP_VERSION, type Backup, type BackupCounts, countsOf } from "../../domain/backup";
import { VERSION } from "../../lib/version";
import { writeZip, type ZipInput } from "../../lib/zip";

/** A backup as bytes, with what it holds and the images the database named but the disk did not have. */
export type TakenBackup = { bytes: Uint8Array; createdAt: Date; counts: BackupCounts; missingImages: string[] };

/**
 * Every image the body names, read from under `root` (the data directory: a
 * backup's image paths are its layout). A path whose file is gone is set to
 * null in the body, so the backup never names a file it does not carry.
 */
async function collectImages(body: BackupBody, root: string): Promise<{ files: ZipInput[]; missing: string[] }> {
  const files: ZipInput[] = [];
  const missing: string[] = [];
  const read = async (path: string | null): Promise<string | null> => {
    if (path === null) return null;
    const file = Bun.file(join(root, path));
    if (!(await file.exists())) {
      missing.push(path);
      return null;
    }
    files.push({ name: path, bytes: new Uint8Array(await file.arrayBuffer()) });
    return path;
  };
  for (const recipe of body.recipes) {
    recipe.image = await read(recipe.image);
    for (const part of recipe.parts) for (const step of part.steps) step.image = await read(step.image);
  }
  for (const event of body.timeline) event.image = await read(event.image);
  return { files, missing };
}

/**
 * The whole household as a backup zip (decisions.md row 131): `garnish.json`
 * deflated, the images beside it stored, every entry stamped `now`. `root` is
 * the data directory the images live under.
 */
export async function takeBackup(repo: BackupRepository, root: string, now: Date = new Date()): Promise<TakenBackup> {
  const body = repo.read();
  const { files, missing } = await collectImages(body, root);
  const backup: Backup = {
    garnish: { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), appVersion: VERSION },
    ...body,
  };
  const json = new TextEncoder().encode(`${JSON.stringify(backup, null, 2)}\n`);
  const bytes = await writeZip([{ name: BACKUP_JSON, bytes: json, compress: true }, ...files], now);
  return { bytes, createdAt: now, counts: countsOf(backup), missingImages: missing };
}
