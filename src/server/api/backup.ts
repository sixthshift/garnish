// The household's backup and restore over HTTP (decisions.md row 131), for
// Settings › Backup. The CLIs (`bun run backup`, `bun run restore`) do the same
// through `src/server/backup/` without a server.
import { basename } from "node:path";
import backups from "../../db/models/backup/repo";
import { backupFileName, countsOf } from "../../domain/backup";
import { BACKUP_FIELD, type RestoreCheck, type RestoreDone } from "../../lib/backup";
import { readBackup, restoreBackup } from "../backup/restore";
import { takeBackup } from "../backup/take";
import { dataDir } from "../core/boot";

/** Largest backup accepted. A household's recipes and photos are far under this. */
export const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

/** Either post, refused: every reason, for the sheet to list. Nothing was written. */
const refused = (problems: string[]): Response => Response.json({ problems }, { status: 400 });

/** GET /api/backup.zip — a fresh backup of the whole household, as a download. */
export async function handleBackupZip(now: Date = new Date()): Promise<Response> {
  const taken = await takeBackup(backups, dataDir(), now);
  return new Response(taken.bytes as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(taken.bytes.length),
      "content-disposition": `attachment; filename="${backupFileName(now)}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * POST /api/restore — multipart, the backup in the `file` field. With
 * `?check=1` it only reads and checks the file and answers what it holds
 * beside what the database holds now; without, it replaces the household's
 * data with it. 400 with every problem for a file it will not restore, in
 * which case nothing was written.
 */
export async function handleRestore(request: Request, now: Date = new Date()): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refused(["Expected a file upload"]);
  }
  const file = form.get(BACKUP_FIELD);
  if (!(file instanceof Blob)) return refused([`Missing file field "${BACKUP_FIELD}"`]);
  if (file.size === 0) return refused(["That file is empty"]);
  if (file.size > MAX_BACKUP_BYTES) return refused(["That file is too large to be a garnish backup"]);
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (new URL(request.url).searchParams.get("check") === "1") {
    const read = await readBackup(bytes);
    if (!read.ok) return refused(read.problems);
    return Response.json({ createdAt: read.backup.garnish.createdAt, backup: countsOf(read.backup), current: backups.counts() } satisfies RestoreCheck);
  }

  const restored = await restoreBackup(backups, dataDir(), bytes, now);
  if (!restored.ok) return refused(restored.problems);
  return Response.json({ createdAt: restored.createdAt, counts: restored.counts, snapshot: basename(restored.snapshot) } satisfies RestoreDone);
}
