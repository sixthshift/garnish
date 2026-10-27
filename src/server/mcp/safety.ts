// The net under an MCP client's deletes: a backup of the whole household taken just before, into
// DATA_DIR/backups beside the ones `bun run backup` writes, so a delete it should not have made is a
// restore away in Settings › Backup.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { backupsDir } from "../../db/backup/snapshot";
import backups from "../../db/models/backup/repo";
import { takeBackup } from "../backup/take";
import { dataDir } from "../core/boot";

/** A burst of deletes is covered by the first one's backup: one per this long. */
export const SAFETY_BACKUP_EVERY_MS = 10 * 60 * 1000;

let lastTaken = 0;

/** `garnish-before-mcp-YYYYMMDD-HHmmss.zip` in UTC. Pure. */
export function safetyBackupName(now: Date): string {
  const iso = now.toISOString();
  return `garnish-before-mcp-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}.zip`;
}

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
  const name = safetyBackupName(now);
  await Bun.write(join(dir, name), taken.bytes);
  lastTaken = now.getTime();
  return name;
}

/** For tests: forget when the last backup was taken. */
export function resetSafetyBackups(): void {
  lastTaken = 0;
}
