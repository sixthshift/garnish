/**
 * The second starter batch: plurals (decisions.md row 128). Corrections to
 * the first batch's foods (`foods.ts`), applied once per database after it,
 * now that the food agrees in number with its unit (row 127).
 *
 * - **Renames** turn a food counted by the piece but named in the plural into
 *   a singular name with that plural: "tea bags" becomes "tea bag" / "tea
 *   bags", so one reads "1 tea bag" and not "1 tea bags". A food mostly
 *   weighed or measured keeps its plural name (chickpeas, almonds, rolled
 *   oats): a measure shows the plural anyway, and "chickpea" is never bought.
 * - **Plurals** give a countable food the one it lacked, or take away one a
 *   recipe never writes: "2 beetroot", "500 g beetroot".
 * - **Aliases** are the other number of a word already listed, which the
 *   matcher, matching exactly, could not reach: "fresh chillies" beside
 *   "fresh chilli".
 *
 * `starter.ts` applies each one only where the food is still as the first
 * batch left it, so a food the household renamed, merged, deleted or gave
 * its own plural keeps what they chose.
 */

import { STARTER_FOODS, type StarterFood } from "./foods";

/** The batch name `seed_batch` records. */
export const FOOD_PLURALS_BATCH = "starter-foods-2";

export type FoodCorrection = {
  /** The food's name in the first batch. */
  name: string;
  /** Its singular name; the first batch's name becomes its plural. */
  rename?: string;
  /** Its plural; null takes the first batch's away. */
  plural?: string | null;
  /** Words it gains. */
  aliases?: readonly string[];
};

export const FOOD_PLURALS: readonly FoodCorrection[] = [
  // Renames: counted by the piece, so the name is the singular.
  { name: "banana leaves", rename: "banana leaf" },
  { name: "pandan leaves", rename: "pandan leaf" },
  { name: "makrut lime leaves", rename: "makrut lime leaf" },
  { name: "curry leaves", rename: "curry leaf" },
  { name: "cardamom pods", rename: "cardamom pod" },
  { name: "whole cloves", rename: "whole clove" },
  { name: "juniper berries", rename: "juniper berry" },
  { name: "candlenuts", rename: "candlenut" },
  {
    name: "dried mexican chillies",
    rename: "dried mexican chilli",
    aliases: ["guajillo chilli", "pasilla chilli", "dried ancho chilli", "dried guajillo chilli"],
  },
  { name: "tea bags", rename: "tea bag" },
  { name: "gelatine sheets", rename: "gelatine sheet", aliases: ["gelatine leaf", "gelatin sheet"] },
  { name: "lasagne sheets", rename: "lasagne sheet", aliases: ["lasagna sheet"] },
  { name: "cannelloni tubes", rename: "cannelloni tube" },
  { name: "taco shells", rename: "taco shell" },
  { name: "wonton wrappers", rename: "wonton wrapper", aliases: ["gow gee wrapper", "gyoza wrapper"] },
  { name: "spring roll wrappers", rename: "spring roll wrapper", aliases: ["spring roll sheet"] },
  { name: "poppadoms", rename: "poppadom", aliases: ["pappadum", "papadum"] },
  { name: "beef cheeks", rename: "beef cheek" },
  { name: "gherkins", rename: "gherkin" },
  { name: "hash browns", rename: "hash brown" },
  { name: "marshmallows", rename: "marshmallow" },

  // Plurals.
  { name: "lobster", plural: "lobsters" },
  { name: "beetroot", plural: null },

  // Aliases: the other number of a word already there.
  { name: "onion", aliases: ["brown or white onions"] },
  { name: "red onion", aliases: ["red salad onions"] },
  { name: "long red chilli", aliases: ["fresh long red chillies", "fresh chillies", "long red chilies"] },
  { name: "long green chilli", aliases: ["fresh green chillies"] },
  { name: "bird's eye chilli", aliases: ["birds eye chillies"] },
  { name: "habanero chilli", aliases: ["scotch bonnets"] },
  { name: "dried chilli", aliases: ["dried chilies"] },
  { name: "cucumber", aliases: ["continental cucumbers"] },
  { name: "swede", aliases: ["rutabagas"] },
  { name: "ham hock", aliases: ["smoked ham hocks"] },
  { name: "rump steak", aliases: ["beef rump steaks"] },
  { name: "sirloin steak", aliases: ["new york strip steaks"] },
  { name: "sausage", aliases: ["smoked sausages", "polish sausages"] },
  { name: "fried tofu puffs", aliases: ["tofu puff"] },
];

/**
 * The starter foods as a new database ends up with them: the first batch with
 * these corrections applied. What the list's own tests and the parser
 * benchmark read against. Pure.
 */
export function correctedStarterFoods(first: readonly StarterFood[] = STARTER_FOODS, corrections: readonly FoodCorrection[] = FOOD_PLURALS): StarterFood[] {
  const byName = new Map(corrections.map((correction) => [correction.name, correction]));
  return first.map((food) => {
    const correction = byName.get(food.name);
    if (correction === undefined) return food;
    const name = correction.rename ?? food.name;
    const plural =
      correction.plural !== undefined ? (correction.plural ?? undefined) : correction.rename !== undefined ? (food.plural ?? food.name) : food.plural;
    const aliases = [...(food.aliases ?? []).filter((alias) => alias !== name), ...(correction.aliases ?? [])];
    return { ...food, name, plural, aliases };
  });
}
