// Writing to the clipboard, the one browser API the action menu needs that is
// not the router. Split the way the other lib/ modules are: a function over an
// injected clipboard-like interface, so tests pass their own, plus the default
// that reaches for the real `navigator.clipboard`.
//
// The Clipboard API is unavailable over plain HTTP on a LAN address in some
// browsers, and rejects when the document is not focused, so every failure is
// reported back as `false` rather than thrown; the caller turns that into a
// toast.

/** The slice of `navigator.clipboard` used here. */
export type ClipboardLike = { writeText: (text: string) => Promise<void> };

/** The browser's clipboard, or null where there is none (server render, older browser). */
export function systemClipboard(): ClipboardLike | null {
  const clipboard = (globalThis as { navigator?: { clipboard?: ClipboardLike } }).navigator?.clipboard;
  return clipboard && typeof clipboard.writeText === "function" ? clipboard : null;
}

/** Write `text`; true when it landed. Never throws. */
export async function writeClipboard(text: string, clipboard: ClipboardLike | null = systemClipboard()): Promise<boolean> {
  if (clipboard === null) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
