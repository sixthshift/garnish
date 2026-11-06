import { useLayout } from "../../../lib/useLayout";
import type { FoodPack, Unit } from "../../recipes/reference";
import type { ShoppingItem } from "../shopping";
import { ShoppingStoreWalk } from "./desktop/ShoppingStoreWalk";
import { ShoppingList } from "./mobile/ShoppingList";

/**
 * The list itself, writes injected. Rendered by the route and by the tests.
 * A phone's is for use in the shop (decisions.md row 208): one column of
 * aisles, the meals as chips that narrow it, and a trolley at the foot; a
 * desktop's is the store walk (row 207): the aisles across the width, the
 * trolley and the meals key beside them.
 */
export function ShoppingListView(props: ShoppingListViewProps) {
  return useLayout() === "desktop" ? <ShoppingStoreWalk {...props} /> : <ShoppingList {...props} />;
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /** Every food's sizes: a line is rounded up to whole packs of them. */
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
