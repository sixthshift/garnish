import type { PlanDay } from "../../plan/plan";
import type { RecipeSummary } from "../../recipes/recipe";
import type { ShoppingItem } from "../../shopping/shopping";

/** What Home draws from, as its loader returns it, on a phone and on a desktop. */
export type HomeData = {
  today: string;
  monday: string;
  days: PlanDay[];
  nextDays: PlanDay[];
  /** Lines still to buy, or null when the list could not be read: Home still draws the day. */
  toBuy: number | null;
  /** The list's lines in list order, for a desktop's shopping tile; null as `toBuy` is. */
  items: ShoppingItem[] | null;
  /** Every recipe, newest first: tonight's time comes from here, and the ones to try. */
  recipes: RecipeSummary[];
};
