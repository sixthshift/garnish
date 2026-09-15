import { IMAGE_TYPES, sniffImage } from "../../../lib/imageFile";

/** The uploaded file, as the parser needs it. */
export type ImportFile = { name: string; bytes: Uint8Array };

/** JSON bytes as a value, with a message for the import screen when they are not JSON. Pure. */
export function parseJsonBytes(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("That file is not JSON or a zip");
  }
}

/** An image's bytes as a `data:` URL, or null when they are not an image this app stores. Pure. */
export function imageDataUrl(bytes: Uint8Array): string | null {
  const ext = sniffImage(bytes);
  if (ext === null) return null;
  return `data:${IMAGE_TYPES[ext]};base64,${Buffer.from(bytes).toString("base64")}`;
}
