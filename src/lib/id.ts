/** A random v4 UUID string. */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID exists only in secure contexts, and the app runs over plain http on the LAN.
  return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
}

/** Sixteen random bytes as a v4 UUID (version and variant bits set). Pure. */
export function uuidFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error(`a UUID needs 16 bytes, got ${bytes.length}`);
  const b = Uint8Array.from(bytes);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
