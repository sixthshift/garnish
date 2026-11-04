// The house rule for a tag's name, the one every way in applies: the editor's
// tag input, every import, and the repository that finally stores it
// (decisions.md row 170). A name is cleaned and given sentence case — the
// first letter capital, the rest as given, so "Thai" and "BBQ" survive — and
// two names are the same tag when their keys match, whatever their case,
// spacing or accents' composition.

/** A tag's name in the house style: whitespace collapsed, a leading `#` dropped, the first letter capital. Empty when nothing is left. Pure. */
export function tagName(raw: string): string {
  const clean = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+\s*/, "");
  return clean === "" ? "" : clean.charAt(0).toLocaleUpperCase("en-AU") + clean.slice(1);
}

/** What two tag names are compared by: the cleaned name, case folded. "one  pot", "One Pot" and "#one pot" share a key. Pure. */
export function tagKey(name: string): string {
  return tagName(name).toLocaleLowerCase("en-AU");
}

/**
 * Every tag name in `values`, each split on commas, cleaned, and kept once by
 * key in first-seen order — the first spelling wins. "dinner, quick" is two
 * tags wherever it comes from. Pure.
 */
export function tagNamesFrom(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const part of value.split(",")) {
      const name = tagName(part);
      const key = name.toLocaleLowerCase("en-AU");
      if (name === "" || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}
