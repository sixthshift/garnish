import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { IMAGE_FOLDERS, type ImageKind } from "../../app/features/settings/model/backup";
import { type ImageExtension, imageFileName } from "../../lib/imageFile";
import { dataDir } from "./boot";

/**
 * Where `kind`'s images sit under the data directory, laid out as a backup
 * lays them out: `images/`, `images/steps/`, `images/timeline/`. Imports no
 * database, so the plain-bun scripts (the dev seed) can use it too.
 */
export function imageDir(kind: ImageKind, root: string = dataDir()): string {
  return join(root, IMAGE_FOLDERS[kind]).replace(/[/\\]$/, "");
}

/**
 * Write `bytes` as `id`'s image in `dir`, and delete any earlier file for that
 * id under another extension. Returns the stored file name.
 */
export async function storeImage(dir: string, id: string, ext: ImageExtension, bytes: Uint8Array): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const name = imageFileName(id, ext);
  await Bun.write(join(dir, name), bytes);
  for (const existing of readdirSync(dir)) {
    if (existing !== name && existing.toLowerCase().startsWith(`${id.toLowerCase()}.`)) unlinkSync(join(dir, existing));
  }
  return name;
}
