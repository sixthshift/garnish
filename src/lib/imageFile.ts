/** Accepted formats, by the extension the file is stored under. */
export const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type ImageExtension = keyof typeof IMAGE_TYPES;

/** Multipart field an upload arrives in. Mealie's is `image` too. */
export const IMAGE_FIELD = "image";

/** Largest upload accepted, in bytes. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_FILE = /^([0-9a-f-]{36})\.(png|jpg|webp|gif)$/i;

function startsWith(bytes: Uint8Array, prefix: number[], at = 0): boolean {
  if (bytes.length < at + prefix.length) return false;
  return prefix.every((b, i) => bytes[at + i] === b);
}

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

/** Format from the magic bytes, or null for anything that is not png/jpeg/webp/gif. Pure. */
export function sniffImage(bytes: Uint8Array): ImageExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  return null;
}

/** The stored file name for a recipe's or event's image. Pure. */
export function imageFileName(id: string, ext: ImageExtension): string {
  return `${id}.${ext}`;
}

/**
 * Content type for a file name this server hands out, or null when the name
 * is not `<uuid>.<ext>`. Anything with a separator, `..` or an unknown
 * extension is null, so a null here is the path-traversal guard. Pure.
 */
export function imageContentType(file: string): string | null {
  const match = IMAGE_FILE.exec(file);
  if (!match) return null;
  return IMAGE_TYPES[match[2]!.toLowerCase() as ImageExtension];
}
