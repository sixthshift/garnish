/** What "Suggest links" says it did. Pure. */
export function suggestNotice(filled: number): string {
  return filled === 0 ? "Nothing to link" : `Linked ${filled} step${filled === 1 ? "" : "s"}`;
}
