import type { ShoppingView } from "../../../lib/prefs";
import { useLayout } from "../../../lib/useLayout";
import type { FoodPack, Unit } from "../../recipes/reference";
import type { ShoppingItem } from "../shopping";
import { ShoppingStoreWalk } from "./desktop/ShoppingStoreWalk";
import { ShoppingList } from "./mobile/ShoppingList";

/**
 * The list itself, writes injected. Rendered by the route and by the tests.
 * A phone's is one column, by aisle or by meal; a desktop's is the store walk
 * (decisions.md row 207): the aisles across the width, the trolley and the
 * meals key beside them.
 */
export function ShoppingListView(props: ShoppingListViewProps) {
  return useLayout() === "desktop" ? <ShoppingStoreWalk {...props} /> : <ShoppingList {...props} />;
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /**
   * By aisle (the shop's order, each line with the dishes it is for under it,
   * ticked lines sunk to the foot) or by meal
   * (each dish's lines, ticked ones left in place). The device remembers it.
   * A phone's choice only: on a desktop the meals key does the meal view's job.
   */
  view?: ShoppingView;
  onViewChange?: (view: ShoppingView) => void;
  /** Every food's sizes: the aisle view rounds a line up to whole packs of them. */
  packs?: readonly FoodPack[];
  /** Every unit: the sizes' own. */
  units?: readonly Unit[];
  /** A line typed into the box at the top, already trimmed and never empty. */
  onAdd: (text: string) => void;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClearTicked: () => void;
  /** A write is in flight: every control is disabled, as the editor's SaveBar does. */
  busy?: boolean;
  /** How many ticks are queued for the server. Shown in the header; 0 shows nothing. */
  pending?: number;
  /**
   * No network: clearing the ticked is refused (it destroys rows the page
   * cannot name one by one), while ticking, removing and adding a line
   * queue. The one exception to the editor's "writes are never attempted
   * offline".
   */
  offline?: boolean;
};
