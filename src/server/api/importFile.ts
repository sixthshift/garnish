import type { FileRecipe } from "../../domain/recipes/import";
import { IMPORT_FIELD } from "../../lib/importFile";
import { importer } from "../import/importer";
import { checkLibrary, importLibrary } from "../import/library";

export { IMPORT_FIELD } from "../../lib/importFile";

/** Largest export accepted. A household's whole Mealie or Tandoor backup is far under this. */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

/** What the route answers with. */
export type ImportFileResult = { recipes: FileRecipe[] };

const badRequest = (error: string): Response => Response.json({ error }, { status: 400 });

/**
 * POST /api/import/file — multipart body with the export in the `file` field.
 * Answers `{ recipes: [...] }`, each recipe in the shape the review step
 * reads — Mealie's export or Tandoor's, told apart by shape — with its image
 * as a `data:` URL when the zip carried one. 400 with a
 * message meant for the import screen for anything unreadable.
 */
export async function handleImportFile(request: Request): Promise<Response> {
  const read = await readUpload(request);
  if (read instanceof Response) return read;
  return Response.json({ recipes: read } satisfies ImportFileResult);
}

/**
 * POST /api/import/library — the same upload, every recipe in it saved
 * (decisions.md row 201). With `?check=1` nothing is written and the answer
 * is what the export holds, for the confirm; otherwise it is the report.
 */
export async function handleImportLibrary(request: Request): Promise<Response> {
  const read = await readUpload(request);
  if (read instanceof Response) return read;
  if (new URL(request.url).searchParams.get("check") === "1") return Response.json(checkLibrary(read));
  return Response.json(await importLibrary(read));
}

/** The recipes in the uploaded export, or the 400 to answer with. */
async function readUpload(request: Request): Promise<FileRecipe[] | Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("expected a multipart/form-data body");
  }
  const file = form.get(IMPORT_FIELD);
  if (!(file instanceof Blob)) return badRequest(`missing file field "${IMPORT_FIELD}"`);
  if (file.size === 0) return badRequest("That file is empty");
  if (file.size > MAX_IMPORT_BYTES) return badRequest("That file is too large to read");

  const name = file instanceof File ? file.name : "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await importer.import({ kind: "file", file: { name, bytes } });
  } catch (cause) {
    return badRequest(cause instanceof Error ? cause.message : "That file could not be read");
  }
}
