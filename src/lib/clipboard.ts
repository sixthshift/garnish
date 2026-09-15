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
