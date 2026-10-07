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

/** One file to write. `compress` deflates it; leave it off for bytes already compressed, such as images. */
export type ZipInput = { name: string; bytes: Uint8Array; compress?: boolean };

/** Bit 11 of the general-purpose flags: the name is UTF-8. */
const UTF8_NAMES = 0x0800;

/** CRC-32, as a zip's headers want it. Pure. */
export function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A date as MS-DOS packs it into a zip header: `[time, date]`, local fields read as UTC. */
function dosDateTime(at: Date): [number, number] {
  const year = Math.min(Math.max(at.getUTCFullYear(), 1980), 2107);
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | Math.floor(at.getUTCSeconds() / 2);
  const date = ((year - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate();
  return [time, date];
}

/**
 * The files as a zip archive, the reader's format in reverse: classic,
 * non-zip64, each entry stored or deflated, names in UTF-8, every entry stamped
 * `modified`. Throws past what a non-zip64 archive can hold.
 */
export async function writeZip(files: readonly ZipInput[], modified: Date = new Date(0)): Promise<Uint8Array> {
  if (files.length > MAX_ZIP_ENTRIES) throw new Error("Too many files for one zip");
  const encoder = new TextEncoder();
  const [time, date] = dosDateTime(modified);
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const method = file.compress ? 8 : 0;
    const body = file.compress ? await deflate(file.bytes) : file.bytes;
    const crc = crc32(file.bytes);

    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, LOCAL_HEADER, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, UTF8_NAMES, true);
    view.setUint16(8, method, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, body.length, true);
    view.setUint32(22, file.bytes.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, CENTRAL_HEADER, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint16(8, UTF8_NAMES, true);
    entryView.setUint16(10, method, true);
    entryView.setUint16(12, time, true);
    entryView.setUint16(14, date, true);
    entryView.setUint32(16, crc, true);
    entryView.setUint32(20, body.length, true);
    entryView.setUint32(24, file.bytes.length, true);
    entryView.setUint16(28, name.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(name, 46);

    local.push(header, body);
    central.push(entry);
    offset += header.length + body.length;
    if (offset > 0xffffffff) throw new Error("Too large for one zip");
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(EOCD_SIZE);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_OF_CENTRAL, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...local, ...central, end];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
