import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { backupsDir } from "../../db/backup/snapshot";
import type { BackupRepository } from "../../db/models/backup/repo";
import { BACKUP_JSON, type Backup, type BackupCounts, checkBackup, countsOf, imagePathsOf } from "../../domain/backup";
import { isZip, readZip } from "../../lib/zip";

/** A backup read and checked, with its image files by path; or every reason it cannot be restored. */
export type ReadBackup = { ok: true; backup: Backup; images: Map<string, Uint8Array> } | { ok: false; problems: string[] };

/** What a restore answers: what it put back and where the database it replaced was kept. */
export type Restored = { ok: true; counts: BackupCounts; createdAt: string; snapshot: string } | { ok: false; problems: string[] };

/**
 * Unzip and check a backup, writing nothing: the zip, `garnish.json` against
 * the format (`checkBackup`), and every image it names present in the zip.
 */
export async function readBackup(bytes: Uint8Array): Promise<ReadBackup> {
  if (!isZip(bytes)) return { ok: false, problems: ["This is not a garnish backup: a backup is a .zip file"] };
  let entries: Awaited<ReturnType<typeof readZip>>;
  try {
    entries = await readZip(bytes);
  } catch (error) {
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] };
  }
  const files = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  const json = files.get(BACKUP_JSON);
  if (!json) return { ok: false, problems: [`This is not a garnish backup: it has no ${BACKUP_JSON}`] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return { ok: false, problems: [`${BACKUP_JSON} is not valid JSON`] };
  }
  const checked = checkBackup(parsed);
  if (!checked.ok) return checked;

  const images = new Map<string, Uint8Array>();
  const problems: string[] = [];
  for (const path of imagePathsOf(checked.backup)) {
    const image = files.get(path);
    if (image) images.set(path, image);
    else problems.push(`${path} is named in ${BACKUP_JSON} but is not in the zip`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, backup: checked.backup, images };
}

/** Where a backup's images are staged before they replace `images/`. */
const STAGING = "images.restoring";

/** Where the images a restore replaced are kept: beside the snapshot, under its name. Pure. */
export function snapshotImagesDir(snapshotPath: string): string {
  return snapshotPath.replace(/\.db$/, "-images");
}

/**
 * Replace the household's data with a backup (decisions.md row 131). In
 * order: read and check the whole file, writing nothing on a failure; take a
 * snapshot of the database as it stands; write the backup's images to a
 * staging folder; replace every household table in one transaction; then
 * move `images/` beside the snapshot and the staged images in for it. Never merges: afterwards the app is
 * exactly as the backup was taken. `root` is the data directory.
 */
export async function restoreBackup(repo: BackupRepository, root: string, bytes: Uint8Array, now: Date = new Date()): Promise<Restored> {
  const read = await readBackup(bytes);
  if (!read.ok) return read;
  const { garnish, ...body } = read.backup;

  const snapshotPath = repo.snapshot(backupsDir(root), now);

  const staging = join(root, STAGING);
  rmSync(staging, { recursive: true, force: true });
  try {
    for (const [path, image] of read.images) {
      // The paths are `images/…`; staged, the `images/` becomes the staging folder.
      const target = join(staging, path.slice("images/".length));
      mkdirSync(dirname(target), { recursive: true });
      await Bun.write(target, image);
    }
    mkdirSync(staging, { recursive: true });
    repo.replace(body);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }

  // The images being replaced go beside the snapshot, so undoing a restore by
  // hand puts back the photos with the database.
  const images = join(root, "images");
  if (existsSync(images)) renameSync(images, snapshotImagesDir(snapshotPath));
  renameSync(staging, images);

  return { ok: true, counts: countsOf(read.backup), createdAt: garnish.createdAt, snapshot: snapshotPath };
}
