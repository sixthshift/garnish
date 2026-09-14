// The uploaded export (M34.3, M34.4). A route rather than a server function,
// because the file is a file: the image upload already posts multipart to
// `/api/recipes/:id/image`, and this joins it rather than inventing a base64
// server function beside it.
//
// Nothing is written here. The route parses and answers; the review step
// (M17.5's rows) is what decides, and the editor's Save is what writes.
import { type FileRecipe, IMPORT_FIELD } from "../../domain/import";
import { importer } from "../import/importer";

export { IMPORT_FIELD } from "../../domain/import";

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
    const recipes = await importer.import({ kind: "file", file: { name, bytes } });
    return Response.json({ recipes } satisfies ImportFileResult);
  } catch (cause) {
    return badRequest(cause instanceof Error ? cause.message : "That file could not be read");
  }
}
