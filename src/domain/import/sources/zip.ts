/** One file in an archive. Directories are dropped by `readZip`. */
export type ZipEntry = { name: string; bytes: Uint8Array };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const ZIP64_END_LOCATOR = 0x07064b50;

/** Largest archive worth walking, and the most entries in one. A backup is far under both. */
export const MAX_ZIP_ENTRIES = 20_000;

/** The last 22 bytes of a zip are its end-of-central-directory record, unless it has a comment. */
const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;

/** A zip's magic bytes: `PK\x03\x04`. Pure. */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Where the end-of-central-directory record starts, or -1. Pure. */
export function findEndOfCentralDirectory(view: DataView): number {
  const from = Math.max(0, view.byteLength - EOCD_SIZE - MAX_COMMENT);
  for (let at = view.byteLength - EOCD_SIZE; at >= from; at -= 1) {
    if (view.getUint32(at, true) === END_OF_CENTRAL) return at;
  }
  return -1;
}

/** Inflate `bytes` compressed with `method` (0 stored, 8 deflate). Throws for anything else. */
export async function inflate(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes;
  if (method !== 8) throw new Error(`This zip uses an unsupported compression method (${method})`);
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Every file in the archive, in central-directory order. Names are the paths
 * the archive holds, with `/`-terminated directory entries dropped. Throws
 * with a message for the import screen when the bytes are not a zip this
 * reader can walk.
 */
export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  if (bytes.length < EOCD_SIZE) throw new Error("That file is not a zip");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error("That file is not a zip");
  // A zip64 archive puts the real offsets somewhere this reader does not look.
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === ZIP64_END_LOCATOR) throw new Error("That zip is too large to read here");

  const count = view.getUint16(eocd + 10, true);
  if (count > MAX_ZIP_ENTRIES) throw new Error("That zip holds too many files");
  let at = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_HEADER) throw new Error("That zip's directory is damaged");
    const flags = view.getUint16(at + 8, true);
    if ((flags & 0x1) !== 0) throw new Error("That zip is encrypted");
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (localAt + 30 > bytes.length || view.getUint32(localAt, true) !== LOCAL_HEADER) throw new Error("That zip's directory is damaged");
    const localName = view.getUint16(localAt + 26, true);
    const localExtra = view.getUint16(localAt + 28, true);
    const from = localAt + 30 + localName + localExtra;
    const to = from + compressedSize;
    if (to > bytes.length) throw new Error("That zip is truncated");
    entries.push({ name, bytes: await inflate(bytes.subarray(from, to), method) });
  }
  return entries;
}
