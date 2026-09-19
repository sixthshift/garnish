// What a restyle must carry beyond its numbers: the conditions that decide whether a step is done at all, and the words the author used to say what to do.

/** A condition as the check reads it: the marker it is compared on, and the author's own clause, for the report to show. */
export type Condition = { marker: string; phrase: string };

/**
 * The words that open a clause deciding whether, or how long, something is
 * done. Longest first, because "or until" is a different condition from
 * "until" — "cook for 2 hours or until tender" offers two stopping points and
 * "cook until tender" offers one, so a rewrite that drops the "or" has changed
 * the method without dropping a word the other checks can see.
 */
const MARKERS = ["as soon as", "or until", "in case", "otherwise", "unless", "until", "while", "once", "when", "if"] as const;

/** How many words of the author's clause the report shows after the marker. */
const PHRASE_WORDS = 6;

const MARKER = new RegExp(String.raw`(?<![\p{L}])(${MARKERS.join("|")})(?![\p{L}])`, "giu");

/**
 * Every condition in the prose, in reading order, each with the clause that
 * follows it cut at the first sentence break, closing bracket, or
 * `PHRASE_WORDS` words — the bracket because an author's aside is where a
 * condition most often hides, and "if using) and simmer for 5 minutes" names
 * the wrong thing. Pure.
 */
export function conditionsOf(prose: readonly string[]): Condition[] {
  const found: Condition[] = [];
  for (const text of prose) {
    for (const match of text.matchAll(MARKER)) {
      const marker = match[1]!.toLowerCase().replace(/\s+/gu, " ");
      const rest = text.slice(match.index + match[0].length);
      const clause = rest
        .split(/[.;:)]/u)[0]!
        .trim()
        .split(/\s+/u)
        .slice(0, PHRASE_WORDS)
        .join(" ");
      found.push({ marker, phrase: clause === "" ? marker : `${marker} ${clause}` });
    }
  }
  return found;
}

/** How alike two clauses are: the share of the shorter one's words the other also has. Pure. */
function overlap(a: string, b: string): number {
  const words = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word !== "")
    );
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/**
 * The conditions the rewrite does not carry, as the author's own phrases —
 * because a bare "if" tells the household nothing.
 *
 * Each original condition is paired with the unclaimed rewritten one that
 * carries the same marker and reads most like it, and what is left over is
 * what went missing. Pairing by likeness rather than in order is what makes the
 * report name the right clause: a recipe with two "if"s that keeps the second
 * and drops the first would otherwise be reported as having dropped the second.
 * A rewrite that keeps the condition and rewords it passes either way — the
 * marker is the logic and the clause is the voice. Pure.
 */
export function missingConditions(original: readonly Condition[], restyled: readonly Condition[]): string[] {
  // Every pairing that could be made, best first, claimed greedily. Scoring all
  // of them before claiming any is what stops the first original condition
  // taking a poor match that a later one would have fitted.
  const pairs: { from: number; to: number; score: number }[] = [];
  original.forEach((condition, from) => {
    restyled.forEach((answer, to) => {
      if (answer.marker !== condition.marker) return;
      pairs.push({ from, to, score: overlap(condition.phrase, answer.phrase) });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);

  const matched = new Set<number>();
  const claimed = new Set<number>();
  for (const pair of pairs) {
    if (matched.has(pair.from) || claimed.has(pair.to)) continue;
    matched.add(pair.from);
    claimed.add(pair.to);
  }
  return original.flatMap((condition, index) => (matched.has(index) ? [] : [condition.phrase]));
}

/**
 * The words a rewrite is free to drop: grammar, and the pronouns and fillers a
 * house style exists to remove. Everything outside this list is the author
 * saying something, so its going is worth reporting even when it was right.
 */
const FREE_WORDS = new Set(
  `a an and the of to in on at by for with from as is are be been was were will would can could may might must shall should do does did done
   it its they them their this that these those there here you your yours we our us i my me he she him her his hers
   then now next also so but or if when while until once unless otherwise than too very just about into onto over under up down out off
   some any all each every both more most other another such no nor not only own same s t don t s ll ve re d m
   let get got go goes going want need`
    .split(/\s+/u)
    .filter((word) => word !== "")
);

/** Endings that are part of the word rather than a plural: "this", "gas", "delicious". */
const NOT_PLURAL = /(?:is|us|as|os|ss)$/u;

/** The shortest a stem may be before an ending is worth stripping; below it, "used" folds to "us". */
const STEM = 4;

/**
 * A word as the check compares it: lower case, no possessive, and the endings
 * a rewrite changes without changing the word folded away, so "seasoning"
 * answers "season" and "juices" answers "juice". Crude on purpose — this feeds
 * a report, not a gate, and a stemmer that merges too much hides a real cut.
 * Pure.
 */
function fold(word: string): string {
  let stem = word.toLowerCase().replace(/[’']s$/u, "");
  // The endings compose rather than race: "juices" loses its plural and then
  // its silent e, so it answers the "juic" that "juice" folds to.
  if (stem.length > STEM && stem.endsWith("ies")) stem = `${stem.slice(0, -3)}y`;
  else if (stem.length > STEM && /(?:ses|hes|xes|zes)$/u.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > STEM && stem.endsWith("s") && !NOT_PLURAL.test(stem)) stem = stem.slice(0, -1);
  if (stem.length > STEM + 3 && stem.endsWith("ing")) stem = stem.slice(0, -3);
  else if (stem.length > STEM + 2 && stem.endsWith("ed")) stem = stem.slice(0, -2);
  // A silent e goes last so the stem of "marbled" answers "marble", which
  // stripping "ed" alone leaves as "marbl".
  if (stem.length > STEM && stem.endsWith("e")) stem = stem.slice(0, -1);
  return stem;
}

/** A word as the check holds it: `text` is what the author wrote, `key` is what it is compared on. */
export type Word = { text: string; key: string };

/**
 * The words that carry meaning, each stem once, in reading order. The stem is
 * for comparing and the spelling is for showing, because a report the
 * household reads should say "including", not the "includ" the stemmer made of
 * it. Numbers are `facts.ts`'s job and are skipped. Pure.
 */
export function contentWordsOf(prose: readonly string[]): Word[] {
  const found: Word[] = [];
  const seen = new Set<string>();
  for (const text of prose) {
    for (const raw of text.split(/[^\p{L}\p{N}’']+/u)) {
      if (raw === "" || /\d/u.test(raw)) continue;
      const key = fold(raw);
      // Both forms are tested against the free list: folding runs first, so
      // "this" would otherwise arrive as a stem the list does not hold.
      if (key.length < 2 || FREE_WORDS.has(raw.toLowerCase()) || FREE_WORDS.has(key) || seen.has(key)) continue;
      seen.add(key);
      found.push({ text: raw.toLowerCase(), key });
    }
  }
  return found;
}

/**
 * The author's words the rewrite no longer uses, as the author spelled them.
 * Reported, never failed: a house style rewords by design, so "sprinkle"
 * becoming "season" is the pass working, and only the household can say
 * whether "pooled" going with it was. Pure.
 */
export function droppedWords(original: readonly Word[], restyled: readonly Word[]): string[] {
  const has = new Set(restyled.map((word) => word.key));
  return original.filter((word) => !has.has(word.key)).map((word) => word.text);
}
