// An imported recipe's lines put in the household's terms before anyone sees
// them (decisions.md row 227): an imperial amount with no metric twin beside it
// is converted, and a line that is two ingredients joined by "+" becomes two
// lines. Pure, and safe to run twice: a converted line has no imperial left.

import type { ScrapedRecipe } from "./scraped/types";

/** A number as recipes write it: "3", "1.5", "1/2", "½", "1 1/2", "1½". */
const NUMBER = String.raw`\d+(?:\.\d+)?(?:\s+\d+\/\d+|\s*[½⅓⅔¼¾⅛⅜⅝⅞])?|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]`;

const GLYPHS: Record<string, number> = { "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };

/** The value of a number `NUMBER` matched. */
function amountOf(text: string): number {
  let total = 0;
  for (const piece of text.trim().split(/\s+/)) {
    const glyph = /^(\d*)([½⅓⅔¼¾⅛⅜⅝⅞])$/.exec(piece);
    if (glyph) total += Number(glyph[1] || 0) + GLYPHS[glyph[2]!]!;
    else if (piece.includes("/")) {
      const [top, bottom] = piece.split("/").map(Number);
      total += top! / bottom!;
    } else total += Number(piece);
  }
  return total;
}

/** A metric number written plainly: whole, or one decimal place without a trailing zero. */
function plain(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Grams as a cook would round them: to 5 under 100, to 10 under a kilo, then kilograms to one decimal. */
function grams(value: number): string {
  if (value >= 1000) return `${plain(value / 1000)} kg`;
  return `${Math.round(value / (value < 100 ? 5 : 10)) * (value < 100 ? 5 : 10)} g`;
}

/** Millilitres the same way, then litres. */
function millilitres(value: number): string {
  if (value >= 1000) return `${plain(value / 1000)} l`;
  return `${Math.round(value / (value < 100 ? 5 : 10)) * (value < 100 ? 5 : 10)} ml`;
}

/** A size: millimetres under an inch, then centimetres to the half. */
function length(mm: number): string {
  return mm < 25 ? `${Math.round(mm)} mm` : `${plain(Math.round(mm / 5) / 2)} cm`;
}

type Measure = {
  /** The imperial unit, after the number. */
  unit: RegExp;
  /** A metric amount of the same kind, which beside it makes the imperial one its twin. */
  twin: RegExp;
  convert: (value: number) => string;
};

const MEASURES: Measure[] = [
  { unit: /(?:fl\.?\s*oz|fluid\s+ounces?)\b/, twin: /\d\s*(?:ml|millilitres?|l|litres?)\b/i, convert: (v) => millilitres(v * 29.5735) },
  { unit: /(?:lbs?|pounds?)\b/, twin: /\d\s*(?:g|kg|grams?|kilograms?)\b/i, convert: (v) => grams(v * 453.592) },
  { unit: /(?:oz|ounces?)\b/, twin: /\d\s*(?:g|kg|grams?|kilograms?)\b/i, convert: (v) => grams(v * 28.3495) },
  { unit: /(?:pints?)\b/, twin: /\d\s*(?:ml|l|litres?)\b/i, convert: (v) => millilitres(v * 473.176) },
  { unit: /(?:quarts?)\b/, twin: /\d\s*(?:ml|l|litres?)\b/i, convert: (v) => millilitres(v * 946.353) },
  { unit: /(?:gallons?)\b/, twin: /\d\s*(?:ml|l|litres?)\b/i, convert: (v) => millilitres(v * 3785.41) },
  { unit: /inch(?:es)?\b/, twin: /\d\s*(?:mm|cm)\b/i, convert: (v) => length(v * 25.4) },
  { unit: /(?:°|º|degrees?\s*)\s*F\b/, twin: /\d\s*(?:°|º|degrees?\s*)\s*C\b/i, convert: (v) => `${Math.round(((v - 32) * 5) / 9)}°C` },
];

/** How far either side of an imperial amount a metric twin may sit: "(¼-inch/6mm thick)", "1 lb / 500g". */
const NEAR = 14;

/**
 * Every imperial amount in `text` that has no metric twin beside it, in
 * metric: "3 pounds beef chuck" is "1.4 kg beef chuck", "325°F" is "163°C",
 * "cut into 2-inch pieces" is "cut into 5 cm pieces". A range converts both
 * ends ("1.2 - 1.5 lb" is "540–680 g"). An amount written beside its metric
 * twin is left for the house style, which keeps the metric one.
 */
export function metricText(text: string): string {
  let out = text;
  for (const measure of MEASURES) {
    const pattern = new RegExp(String.raw`(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?([\s-]*${measure.unit.source})`, "gi");
    out = out.replace(pattern, (match, low: string, high: string | undefined, _unit: string, offset: number, whole: string) => {
      const near = whole.slice(Math.max(0, offset - NEAR), offset) + whole.slice(offset + match.length, offset + match.length + NEAR);
      if (measure.twin.test(near)) return match;
      const from = measure.convert(amountOf(low));
      if (high === undefined) return from;
      const to = measure.convert(amountOf(high));
      const [fromNumber, fromUnit] = splitUnit(from);
      const [toNumber, toUnit] = splitUnit(to);
      return fromUnit === toUnit ? `${fromNumber}–${toNumber}${fromUnit}` : `${from}–${to}`;
    });
  }
  return out;
}

/** "540 g" as ["540", " g"], "163°C" as ["163", "°C"]. */
function splitUnit(amount: string): [string, string] {
  const match = /^([\d.]+)(.*)$/.exec(amount);
  return match ? [match[1]!, match[2]!] : [amount, ""];
}

/**
 * A line that is two ingredients joined by "+" or "plus", each with its own
 * amount, as two lines: "1 large egg + 1 egg yolk, at room temperature" is
 * "1 large egg, at room temperature" and "1 egg yolk, at room temperature" —
 * a note after the second is said of both when the first has none of its own.
 * "2 and 1/4 cups" is one amount, not two ingredients, and stays.
 */
export function splitCombined(line: string): string[] {
  const match = new RegExp(String.raw`^(.*?\S)\s*(?:\+|\bplus\b)\s*((?:${NUMBER})\s+\S.*)$`, "i").exec(line.trim());
  if (match === null || !new RegExp(String.raw`^(?:${NUMBER})\s`).test(match[1]!)) return [line];
  const [, first, second] = match;
  const comma = second!.indexOf(",");
  const note = comma === -1 ? "" : second!.slice(comma);
  return [first!.includes(",") || note === "" ? first! : `${first}${note}`, second!];
}

/** The recipe with every ingredient line split and converted, and every step converted. */
export function houseLines(recipe: ScrapedRecipe): ScrapedRecipe {
  return {
    ...recipe,
    parts: recipe.parts.map((part) => ({
      ...part,
      ingredients: part.ingredients.flatMap(splitCombined).map(metricText),
      steps: part.steps.map(metricText),
    })),
  };
}
