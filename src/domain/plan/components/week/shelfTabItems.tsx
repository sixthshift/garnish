import { Muted } from "@sixthshift/design-system/muted";
import { Spinner } from "@sixthshift/design-system/spinner";
import type { TabItem } from "@sixthshift/design-system/tabs";
import type { ReactNode } from "react";
import type { RecipeSummary } from "../../../recipes/recipe";
import { emptyShelfLine, SHELF_TABS, shelfTab } from "./shelf";

/**
 * The shelf's four tabs as the Tabs control takes them: a spinner while the
 * recipes load, the empty tab's line, or `list` of the tab's recipes, which
 * the board's shelf draws as rows and the phone's sheet as photo tiles.
 */
export function shelfTabItems(recipes: readonly RecipeSummary[] | null | undefined, list: (shelf: RecipeSummary[], label: string) => ReactNode): TabItem[] {
  return SHELF_TABS.map(({ value, label }) => {
    const shelf = recipes ? shelfTab(recipes, value) : [];
    return {
      value,
      label,
      content:
        recipes === null ? (
          <div className="flex justify-center py-6">
            <Spinner aria-label="Loading recipes" />
          </div>
        ) : shelf.length === 0 ? (
          <Muted as="p" className="py-4 text-sm">
            {emptyShelfLine(value)}
          </Muted>
        ) : (
          list(shelf, label)
        ),
    };
  });
}
