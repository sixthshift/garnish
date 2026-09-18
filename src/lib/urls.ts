/**
 * The text shown for a source URL: its host without a leading "www.", so a
 * long recipe URL stays one readable word. A value that is not a URL is shown
 * verbatim (it may be a book or a person). Empty for null or blank. Pure.
 */
export function sourceLabel(url: string | null): string {
  if (url === null || url.trim() === "") return "";
  const trimmed = url.trim();
  try {
    const host = new URL(trimmed).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return trimmed;
  }
}

/** True when a source URL is something a browser can follow. Pure. */
export function isLinkable(url: string | null): boolean {
  if (url === null || url.trim() === "") return false;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const HTTP_URL = /https?:\/\/[^\s<>"']+/;

/**
 * The address a share sheet handed over. Android's share puts a browser's
 * URL in `text` as often as in `url`, and some apps send it inside a
 * sentence, so each field is tried whole and then scanned for the first
 * http(s) address. Null when none of them holds one. Pure.
 */
export function sharedUrl(fields: { url?: string; text?: string; title?: string }): string | null {
  for (const value of [fields.url, fields.text, fields.title]) {
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (isLinkable(trimmed)) return trimmed;
    const found = HTTP_URL.exec(trimmed)?.[0];
    if (found !== undefined) return found.replace(/[.,;:!?)]+$/, "");
  }
  return null;
}
