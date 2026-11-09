// What a rewrite can get wrong while losing nothing: the same instruction said twice, a step with nothing to do, an
// ingredient note pasted into a sentence, imperial units and words from another kitchen. Reported, never failed:
// the household is shown each one beside the house style's version and decides.

import type { OriginalPart, RestyledPart } from "./restyleCheck";

/** One thing that reads wrong in a rewrite, and the words it is about. */
export type ReadingIssue = {
  kind: "repeated" | "idle" | "fragment" | "imperial" | "word" | "heading" | "prep";
  /** The rewrite's own words the issue is about, as they read there. */
  item: string;
  /** What to tell the household, one sentence. */
  message: string;
};

/** How long a run of words has to be before saying it twice counts: long enough that "1 tbsp of the vegetable oil in" does not. */
const RUN = 7;

/** A supporting line that gives another way of doing the step: written out whole, as the house style asks, so it repeats the step's words by design. */
const ALTERNATIVE = /^(?:alternatively|or\b|instead\b|to (?:bake|cook|make) (?:it|them) (?:in|on))|\b(?:can instead|instead of)\b/i;

/** A step's or a note's words, folded for comparing: lower case, letters and digits only. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}½¼¾⅓⅔]+/gu) ?? [];
}

/** Every run of `RUN` words in each text, mapped to the texts it is in. */
function runsByText(texts: readonly string[]): Map<string, Set<number>> {
  const runs = new Map<string, Set<number>>();
  texts.forEach((text, t) => {
    const words = wordsOf(text);
    for (let i = 0; i + RUN <= words.length; i++) {
      const run = words.slice(i, i + RUN).join(" ");
      const at = runs.get(run) ?? new Set<number>();
      at.add(t);
      runs.set(run, at);
    }
  });
  return runs;
}

/**
 * Each step's text and its supporting line as separate texts: an instruction
 * said in both is said twice. A supporting line that is another way of doing
 * the step is left out, since it repeats the step on purpose.
 */
function stepTexts(parts: readonly { steps: readonly { text: string; summary?: string }[] }[]): string[] {
  return parts
    .flatMap((part) => part.steps.flatMap((step) => [step.text, ALTERNATIVE.test((step.summary ?? "").trim()) ? "" : (step.summary ?? "")]))
    .filter((text) => text.trim() !== "");
}

/**
 * The runs of words the rewrite says in two places — two steps, or a step and
 * its own supporting line — that the author did not already say twice. One
 * finding for each pair of places, however long the shared run. Pure.
 */
export function repeatedRuns(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): string[] {
  const authorRepeats = new Set([...runsByText(stepTexts(original))].filter(([, at]) => at.size > 1).map(([run]) => run));
  const pairs = new Map<string, string>();
  for (const [run, at] of runsByText(stepTexts(restyled))) {
    if (at.size < 2 || authorRepeats.has(run)) continue;
    const key = [...at].slice(0, 2).join(":");
    if (!pairs.has(key)) pairs.set(key, run);
  }
  return [...pairs.values()];
}

/** A step that only puts something aside, or only waits, with no time and no cue: nothing for the cook to do there. */
const IDLE = /^(?:set|leave|keep|put|let)\b[^.]*?\b(?:aside|rest|stand|sit)\b[^.]*?\.?$/i;

/** Steps whose whole text is an idle instruction, with no number and no "until". Pure. */
export function idleSteps(restyled: readonly RestyledPart[]): string[] {
  return restyled
    .flatMap((part) => part.steps)
    .map((step) => step.text.trim())
    .filter((text) => IDLE.test(text) && !/\d|\buntil\b/i.test(text));
}

/**
 * An ingredient's note pasted into a sentence after its food, "the water,
 * hot": the note's words belong on the list, and in a step they read as a
 * fragment. Only a short first phrase of the note, and only right after the
 * food's own name.
 * Pure.
 */
export function noteFragments(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): string[] {
  const rows = original.flatMap((part) => part.ingredients);
  const prose = restyled.flatMap((part) => part.steps.flatMap((step) => [step.text, step.summary])).join("\n");
  const found = new Set<string>();
  for (const part of restyled) {
    part.rows.forEach((row, i) => {
      const food = rows[row]?.food;
      // The note's first phrase: "hot, to soak the mushrooms" is pasted in as "the water, hot" just the same.
      const note = (part.notes[i] ?? "").split(/[,;(]/)[0]!.trim().replace(/[.]+$/, "");
      if (!food || note === "" || note.split(/\s+/).length > 3) return;
      for (const name of [food.name, food.pluralName ?? ""].filter((n) => n.trim() !== "")) {
        const pattern = new RegExp(`\\b${escapeRegExp(name.trim())},\\s+${escapeRegExp(note)}\\b`, "i");
        const match = prose.match(pattern);
        if (match) found.add(match[0]);
      }
    });
  }
  return [...found];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** An imperial measure in a step or a note: inches, quarts, ounces, pounds, pints, gallons, °F, a fraction glyph's included ("¼-inch"). Cups and spoons are the household's own. */
const IMPERIAL =
  /(?<![\w½¼¾⅓⅔.])[\d½¼¾⅓⅔][\d./½¼¾⅓⅔]*(?:\s*(?:to|-|–)\s*[\d½¼¾⅓⅔][\d./½¼¾⅓⅔]*)?[\s-]*(?:inch(?:es)?|in\.|"|qt\.?|quarts?|oz\.?|ounces?|lbs?\.?|pounds?|pints?|gallons?|fl\.?\s?oz)(?=\W|$)|\b\d+\s*°\s*F\b/gi;

/** The imperial measures the rewrite's steps and notes still carry. Pure. */
export function imperialMeasures(restyled: readonly RestyledPart[]): string[] {
  const texts = restyled.flatMap((part) => [...part.steps.flatMap((step) => [step.title, step.text, step.summary]), ...part.notes]);
  return [...new Set(texts.flatMap((text) => text.match(IMPERIAL) ?? []).map((measure) => measure.trim()))];
}

/** Another kitchen's word, and the household's for the same thing (the seeded guide's Australian kitchen words, and its foods). */
const OTHER_WORDS: readonly [RegExp, string][] = [
  [/\bskillets?\b/i, "frying pan"],
  [/\bbaking sheets?\b|\bsheet pans?\b/i, "baking tray"],
  [/\bparchment(?: paper)?\b/i, "baking paper"],
  [/\bbroil(?:er|ed|ing)?\b/i, "grill"],
  [/\bimmersion blender\b/i, "stick blender"],
  [/\bcheesecloth\b/i, "muslin"],
  [/\bpackages?\b/i, "packet"],
  [/\bpreheat(?:ed|ing)?\b/i, "heat"],
  [/\bscallions?\b/i, "spring onion"],
  [/\bcornstarch\b/i, "cornflour"],
  [/\bcilantro\b/i, "coriander"],
  [/\ball-purpose flour\b/i, "plain flour"],
  [/\b(?:powdered|confectioners'?) sugar\b/i, "icing sugar"],
  [/\bground (?:beef|pork|chicken|lamb|turkey)\b/i, "mince"],
];

/** The other kitchen's words the rewrite's steps still use, each with the household's word for it. Pure. */
export function otherKitchenWords(restyled: readonly RestyledPart[]): { word: string; ours: string }[] {
  const prose = restyled.flatMap((part) => part.steps.flatMap((step) => [step.title, step.text, step.summary])).join("\n");
  return OTHER_WORDS.flatMap(([pattern, ours]) => {
    const match = prose.match(pattern);
    return match ? [{ word: match[0], ours }] : [];
  });
}

/**
 * A part named for how the list was sorted rather than for what it makes —
 * "For the rest of the dish", "For the chicken and marinade", "Choose one",
 * "Extras" — which the house style lays out by what is made instead. Pure.
 */
const SORTING_HEADING = /^(?:for\b|(?:the )?rest of\b|choose\b|extras?\b|optional\b|other ingredients\b|everything else\b)/i;

export function sortingHeadings(restyled: readonly RestyledPart[]): string[] {
  return restyled.map((part) => part.name.trim()).filter((name) => SORTING_HEADING.test(name));
}

/** A step that prepares everything: what the house style's "Prepare the ingredients" is labelled. */
const PREP_STEP = /^prepare\b/i;

/**
 * The prep step when it is not the recipe's first step — after a marinade's
 * own step, say — with where it is: cutting comes before anything is cooked
 * or marinated. Null when there is no prep step or it is first. Pure.
 */
export function latePrepStep(restyled: readonly RestyledPart[]): { title: string; n: number } | null {
  const steps = restyled.flatMap((part) => part.steps);
  const at = steps.findIndex((step) => PREP_STEP.test(step.title.trim()));
  return at > 0 ? { title: steps[at]!.title.trim(), n: at + 1 } : null;
}

/**
 * Everything that reads wrong in a rewrite, each worded for the household.
 * The check over what the rewrite kept is `checkRestyle`; this is the one
 * over how it reads. Pure.
 */
export function readingIssues(original: readonly OriginalPart[], restyled: readonly RestyledPart[]): ReadingIssue[] {
  return [
    ...repeatedRuns(original, restyled).map((item) => ({ kind: "repeated" as const, item, message: `“${item}…” is said twice.` })),
    ...idleSteps(restyled).map((item) => ({ kind: "idle" as const, item, message: `“${item}” is a step with nothing to do.` })),
    ...noteFragments(original, restyled).map((item) => ({
      kind: "fragment" as const,
      item,
      message: `“${item}” reads as a list note pasted into a sentence.`,
    })),
    ...imperialMeasures(restyled).map((item) => ({ kind: "imperial" as const, item, message: `“${item}” is still imperial.` })),
    ...[latePrepStep(restyled)].flatMap((late) =>
      late === null
        ? []
        : [{ kind: "prep" as const, item: late.title, message: `“${late.title}” is step ${late.n}: it belongs first, before anything is cooked or marinated.` }]
    ),
    ...sortingHeadings(restyled).map((item) => ({
      kind: "heading" as const,
      item,
      message: `“${item}” only sorts the list: its lines belong in the parts that use them.`,
    })),
    ...otherKitchenWords(restyled).map(({ word, ours }) => ({ kind: "word" as const, item: word, message: `“${word}” is not the household's word: ${ours}.` })),
  ];
}
