/** Each line trimmed of leading and trailing whitespace; blank lines stay blank, so a separator survives. Pure. */
export function trimLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

/** Each line with a leading numbered-list marker ("1.", "2)", "10 ", "3:") removed. A line with no such marker is unchanged. Pure. */
export function stripLeadingNumbers(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.):]?\s*/, ""))
    .join("\n");
}

/**
 * `text` split into paragraphs: blocks separated by one or more blank lines,
 * each block's own lines trimmed and joined with a single space. A block that
 * comes out blank (a run of empty lines) is dropped, so leading, trailing and
 * doubled separators disappear rather than becoming empty paragraphs. Pure.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .join(" ")
    )
    .filter((paragraph) => paragraph !== "");
}

/** `text` rejoined with one paragraph per line: what "Split on blank lines" shows back in the textarea. Pure. */
export function splitOnBlankLines(text: string): string {
  return paragraphs(text).join("\n");
}

/** The items "Add" commits: `text` split on newlines, each trimmed, blank lines dropped. Pure. */
export function bulkLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
