// The net under an MCP client's deletes: a backup of the whole household taken just before, into
// DATA_DIR/backups beside the ones `bun run backup` writes, so a delete it should not have made is a
// restore away in Settings › Backup.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { backupFileName } from "../../app/features/settings/model/backup";
import backups from "../../db/models/backup/repo";
import { takeBackup } from "../backup/take";
import { backupsDir, dataDir } from "../core/boot";

/** A burst of deletes is covered by the first one's backup: one per this long. */
export const SAFETY_BACKUP_EVERY_MS = 10 * 60 * 1000;

let lastTaken = 0;

/**
 * Take a backup before a destructive call, unless one was taken in the last
 * ten minutes. Returns the file's name when one was written, null when the
 * last one still covers this call.
 */
export async function backupBeforeDelete(now: Date = new Date()): Promise<string | null> {
  if (now.getTime() - lastTaken < SAFETY_BACKUP_EVERY_MS) return null;
  const root = dataDir();
  const taken = await takeBackup(backups, root, now);
  const dir = backupsDir(root);
  mkdirSync(dir, { recursive: true });
  const name = backupFileName(now, "before-mcp");
  await Bun.write(join(dir, name), taken.bytes);
  lastTaken = now.getTime();
  return name;
}

/** For tests: forget when the last backup was taken. */
export function resetSafetyBackups(): void {
  lastTaken = 0;
}
