import type { BackupCounts } from "../domain/backup";

/** The multipart field a backup travels in. The restore route reads the same name. */
export const BACKUP_FIELD = "file";

/** Where a fresh backup downloads from. */
export const BACKUP_URL = "/api/backup.zip";

/** Where a backup is posted to be checked (`?check=1`) or restored. */
export const RESTORE_URL = "/api/restore";

/** What the backup holds beside what the database holds now. Nothing has been written. */
export type RestoreCheck = { createdAt: string; backup: BackupCounts; current: BackupCounts };
/** What was put back, and the file name the old database was kept under in `backups/`. */
export type RestoreDone = { createdAt: string; counts: BackupCounts; snapshot: string };

/** A restore the server refused, with every reason; nothing was written. */
export class RestoreRefused extends Error {
  constructor(readonly problems: string[]) {
    super(problems[0] ?? "That backup could not be restored");
  }
}

/** The slice of `fetch` used here; injectable for tests. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function post<T>(url: string, file: File, fetcher: Fetcher): Promise<T> {
  const body = new FormData();
  body.append(BACKUP_FIELD, file);
  const response = await fetcher(url, { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as T & { problems?: string[] };
  if (!response.ok) throw new RestoreRefused(payload.problems ?? [`That backup could not be read (${response.status})`]);
  return payload;
}

/** Read and check a backup on the server without restoring it. Throws `RestoreRefused`. */
export function checkRestore(file: File, fetcher: Fetcher = fetch): Promise<RestoreCheck> {
  return post(`${RESTORE_URL}?check=1`, file, fetcher);
}

/** Replace the household's data with a backup. Throws `RestoreRefused`, having changed nothing. */
export function restore(file: File, fetcher: Fetcher = fetch): Promise<RestoreDone> {
  return post(RESTORE_URL, file, fetcher);
}
