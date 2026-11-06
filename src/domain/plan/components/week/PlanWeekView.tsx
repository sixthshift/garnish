import { useLayout } from "../../../../lib/useLayout";
import type { RecipeSummary } from "../../../recipes/recipe";
import type { Meal, PlanDay, PlanEntry } from "../../plan";
import { PlanBoard } from "./desktop/PlanBoard";
import { PlanPhone } from "./mobile/PlanPhone";

export type PlanWeekViewProps = {
  monday: string;
  days: readonly PlanDay[];
  /** The week after `monday`'s, which a desktop's board and a phone's list both show beneath it. Left out, they show the one week. */
  nextDays?: readonly PlanDay[];
  /** Today's date, injected so a render test does not move with the clock. */
  today?: string;
  /** A plain line was added from a day's sheet. `meal` is null unless a chip was pressed. */
  onAddText: (date: string, text: string, meal: Meal | null) => void;
  /** A recipe was picked from a day's sheet, with the chip pressed at the time. */
  onAddRecipe: (date: string, recipe: RecipeSummary, meal: Meal | null) => void;
  /** An entry was dragged, swiped to the next day, or moved from its menu, to `date` at `position`. */
  onMove: (entry: PlanEntry, date: string, position: number) => void;
  onRemove: (entry: PlanEntry) => void;
  /** Feeds the add sheet's search. Left out, the sheet still takes a plain line. */
  searchRecipes?: (query: string) => Promise<RecipeSummary[]>;
  /** Every recipe, for a desktop's shelf and a phone's add sheet. Left out, both have their search and no tabs to browse. */
  shelfRecipes?: () => Promise<RecipeSummary[]>;
  /** A write is in flight: every control is disabled, as the other pages do. */
  busy?: boolean;
};

/**
 * The week itself, writes injected. Rendered by the route and by the tests.
 *
 * On a phone, the days down one page under a sticky strip of day buttons,
 * this week and then the next, opening at today; entries swipe, and adding
 * is a sheet of photos that stays open for the next (decisions.md row 208,
 * `mobile/PlanPhone`).
 *
 * On a desktop, a board (decisions.md row 207): this week and the next side
 * by side with a shelf of recipes to click or drag onto a day.
 */
export function PlanWeekView(props: PlanWeekViewProps) {
  const desktop = useLayout() === "desktop";
  return desktop ? <PlanBoard {...props} /> : <PlanPhone {...props} />;
}
