// Posting an uploaded Mealie or Tandoor export to the parser (M34.3, M34.4). The twin of
// `uploadRecipeImage` in ./images: a multipart POST to a route under /api,
// with the `fetch` injectable so a test can drive it without a server.
import { type FileRecipe, IMPORT_FIELD } from "../domain/import";

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
