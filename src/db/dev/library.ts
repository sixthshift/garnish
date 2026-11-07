import type { DevRecipe } from "./build";
import { bananaBread } from "./recipes/bananaBread";
import { beefRagu } from "./recipes/beefRagu";
import { bulgogiBowls } from "./recipes/bulgogiBowls";
import { chickenStock } from "./recipes/chickenStock";
import { dalTadka } from "./recipes/dalTadka";
import { fishTacos } from "./recipes/fishTacos";
import { lambSouvlaki } from "./recipes/lambSouvlaki";
import { mapoTofu } from "./recipes/mapoTofu";
import { minestrone } from "./recipes/minestrone";
import { mushroomRisotto } from "./recipes/mushroomRisotto";
import { porkNoodleSalad } from "./recipes/porkNoodleSalad";
import { pumpkinSalad } from "./recipes/pumpkinSalad";
import { quicheLorraine } from "./recipes/quicheLorraine";
import { roastChicken } from "./recipes/roastChicken";
import { shakshuka } from "./recipes/shakshuka";
import { shortcrustPastry } from "./recipes/shortcrustPastry";
import { slowRoastLamb } from "./recipes/slowRoastLamb";
import { stickyDatePudding } from "./recipes/stickyDatePudding";
import { teriyakiSalmon } from "./recipes/teriyakiSalmon";
import { thaiGreenCurry } from "./recipes/thaiGreenCurry";

/**
 * The dev library: twenty recipes a household might really keep, hand-written
 * in the house style (decisions.md row 124). Weeknight regulars cooked often,
 * a few weekend projects, building blocks the others link to as sub-recipes
 * (the stock and the pastry), baking, a salad and a soup; three added lately
 * and never made, a few unrated. Insertion order; the
 * list sorts them by their own dates.
 */
export const DEV_LIBRARY: readonly DevRecipe[] = [
  chickenStock,
  shortcrustPastry,
  beefRagu,
  roastChicken,
  thaiGreenCurry,
  dalTadka,
  teriyakiSalmon,
  bulgogiBowls,
  porkNoodleSalad,
  mapoTofu,
  lambSouvlaki,
  shakshuka,
  fishTacos,
  mushroomRisotto,
  slowRoastLamb,
  minestrone,
  pumpkinSalad,
  bananaBread,
  stickyDatePudding,
  quicheLorraine,
];

/**
 * One entry of the dev week, so many days from the seed's today: a recipe
 * (by its document) or a plain line. Most entries name no meal, as most of a
 * real plan does (the plan's `meal` comment).
 */
export type DevPlanEntry = { day: number; recipe?: DevRecipe; text?: string; servings?: number; meal?: "breakfast" | "lunch" | "dinner" };

/**
 * The week around today: the last few nights already cooked, tonight, and the
 * nights ahead, with a brunch, a night out and leftovers, so Home, Plan and
 * the shopping list open on something real.
 */
export const DEV_PLAN: readonly DevPlanEntry[] = [
  { day: -3, recipe: bulgogiBowls },
  { day: -2, recipe: dalTadka },
  { day: -1, text: "Leftover dal" },
  { day: 0, recipe: roastChicken },
  { day: 1, recipe: thaiGreenCurry },
  { day: 2, text: "Dinner at Mum's" },
  { day: 3, recipe: shakshuka, meal: "breakfast", servings: 2 },
  { day: 3, recipe: mushroomRisotto },
  { day: 4, recipe: beefRagu, servings: 4 },
  { day: 5, recipe: lambSouvlaki },
  { day: 6, recipe: fishTacos },
];
