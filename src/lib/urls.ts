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
