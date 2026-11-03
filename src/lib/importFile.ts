import type { FileRecipe } from "../domain/import";

/** The multipart field the export travels in. The upload route reads the same name. */
export const IMPORT_FIELD = "file";

/** Where the upload goes. */
export const IMPORT_FILE_URL = "/api/import/file";

/** The slice of `fetch` used here; injectable for tests. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * The recipes in an uploaded export. Throws with the route's message — which
 * is written for the import screen — when it could not be read.
 */
export async function postImportFile(file: File, fetcher: Fetcher = fetch): Promise<FileRecipe[]> {
  const body = new FormData();
  body.append(IMPORT_FIELD, file);
  const response = await fetcher(IMPORT_FILE_URL, { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as { recipes?: FileRecipe[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? `That file could not be read (${response.status})`);
  return payload.recipes ?? [];
}

/** Where a whole export goes to be brought in. */
export const IMPORT_LIBRARY_URL = "/api/import/library";

/** What an export holds, before anything is written. Mirrors the server's `LibraryCheck`. */
export type LibraryCheck = { recipes: number; alreadyHere: number; names: string[] };

/** What a whole-library import did. Mirrors the server's `LibraryReport`. */
export type LibraryReport = {
  imported: { name: string; slug: string }[];
  skipped: { name: string; slug: string }[];
  failed: { name: string; error: string }[];
  foodsCreated: number;
  unitsCreated: number;
};

async function postLibrary<T>(file: File, check: boolean, fetcher: Fetcher): Promise<T> {
  const body = new FormData();
  body.append(IMPORT_FIELD, file);
  const response = await fetcher(check ? `${IMPORT_LIBRARY_URL}?check=1` : IMPORT_LIBRARY_URL, { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `That file could not be read (${response.status})`);
  return payload;
}

/** Count what an export holds and how much is already here. Writes nothing. */
export function checkImportLibrary(file: File, fetcher: Fetcher = fetch): Promise<LibraryCheck> {
  return postLibrary<LibraryCheck>(file, true, fetcher);
}

/** Bring every recipe in an export in. */
export function importLibrary(file: File, fetcher: Fetcher = fetch): Promise<LibraryReport> {
  return postLibrary<LibraryReport>(file, false, fetcher);
}
