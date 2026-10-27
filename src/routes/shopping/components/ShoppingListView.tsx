import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import { FoodEditSheet, type FoodPatch } from "../../../components/food/FoodEditSheet";
import { Page, PageHeader } from "../../../components/shell/Page";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { dayLabel } from "../../../domain/plan";
import type { Aisle, Food, FoodPack, Unit } from "../../../domain/reference";
import { groupByAisle, groupByMeal, mealsOf, type ShoppingItem, sizesByFood } from "../../../domain/shopping";
import { pendingLabel } from "../../../lib/outbox";
import type { ShoppingView } from "../../../lib/prefs";
import { AddItemForm } from "./AddItemForm";
import { ShoppingRow } from "./ShoppingRow";
import { toBuyLabel } from "./shoppingListActions";

const VIEWS = [
  { value: "aisles", label: "Aisles" },
  { value: "meals", label: "Meals" },
] as const;

/** A list line's food as the food sheet edits it: the aisle as an id, as Settings › Foods holds it. */
function foodRow({ aisle, ...food }: Food) {
  return { ...food, aisleId: aisle?.id ?? null };
}

const isView = (value: string): value is ShoppingView => VIEWS.some((view) => view.value === value);

/** The list itself, writes injected. Rendered by the route and by the tests. */
export function ShoppingListView({
  items,
  view = "aisles",
  onViewChange = () => {},
  aisles = [],
  packs = [],
  units = [],
  onSaveFood,
  onCreateAisle,
  onAdd,
  onTick,
  onRemove,
  onClearTicked,
  onSetAisle = () => {},
  busy = false,
  pending = 0,
  offline = false,
}: ShoppingListViewProps) {
  const rowProps = { aisles, onTick, onRemove, onSetAisle, busy };
  const sizes = sizesByFood(packs, units);
  // Clearing deletes every ticked line at once and nothing brings them back, so it asks first;
  // the button that opens the question is neutral and the dialog's is the red one (rule 5).
  const [confirming, setConfirming] = useState(false);
  // The food a row's "Edit food" opened, in the same sheet Settings › Foods uses.
  const [editing, setEditing] = useState<Food | null>(null);
  const editFood = onSaveFood && onCreateAisle ? setEditing : undefined;
  const tickedCount = items.filter((item) => item.ticked).length;

  return (
    <Page width="focus">
      <PageHeader
        title="Shopping"
        actions={
          <>
            {pending > 0 && (
              <Badge intent="warning" data-testid="shopping-pending">
                {pendingLabel(pending)}
              </Badge>
            )}
            {items.length > 0 && <Muted as="p">{toBuyLabel(items)}</Muted>}
          </>
        }
      />

      <AddItemForm onAdd={onAdd} busy={busy} />

      <EmptyBoundary
        isEmpty={items.length === 0}
        fallback={
          <div className="flex flex-col gap-1 py-8 text-center" data-testid="shopping-empty">
            <p className="font-medium">Nothing on the list.</p>
            <Muted as="p">Type a line above, or add a recipe's ingredients from its page.</Muted>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            appearance="segmented"
            size="sm"
            aria-label="Group the list by"
            className="self-start"
            options={VIEWS}
            value={view}
            onValueChange={(value) => isView(value) && onViewChange(value)}
          />
          <div className="flex flex-col gap-6" data-testid="shopping-groups" data-view={view}>
            {view === "aisles"
              ? groupByAisle(items).map((group) => (
                  <section key={group.key} className="flex flex-col gap-1" aria-label={group.name} data-testid="shopping-group">
                    <div className="flex items-center justify-between gap-3">
                      <SectionTitle as="h2">{group.name}</SectionTitle>
                      {group.ticked && (
                        <Button type="button" variant="ghost" intent="neutral" size="sm" disabled={busy || offline} onClick={() => setConfirming(true)}>
                          Clear ticked
                        </Button>
                      )}
                    </div>
                    <ul className="flex flex-col divide-y divide-border-subtle">
                      {group.items.map((item) => (
                        <ShoppingRow
                          key={item.id}
                          item={item}
                          meals={mealsOf(item)}
                          sizes={item.food === null ? undefined : (sizes.get(item.food.id) ?? [])}
                          onEditFood={editFood}
                          {...rowProps}
                        />
                      ))}
                    </ul>
                  </section>
                ))
              : groupByMeal(items).map((group) => {
                  // "Lemon tart, Mon 26 Oct": the same recipe on two days is two groups, and the landmark has to say which.
                  const day = group.date === null ? null : dayLabel(group.date);
                  return (
                    <section
                      key={group.key}
                      className="flex flex-col gap-1"
                      aria-label={day === null ? group.name : `${group.name}, ${day}`}
                      data-testid="shopping-group"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <SectionTitle as="h2">{group.name}</SectionTitle>
                        {day !== null && <Muted as="span">{day}</Muted>}
                      </div>
                      <ul className="flex flex-col divide-y divide-border-subtle">
                        {group.rows.map((row) => (
                          <ShoppingRow key={row.item.id} item={row.item} label={row.label} whole={row.whole} onEditFood={editFood} {...rowProps} />
                        ))}
                      </ul>
                    </section>
                  );
                })}
          </div>
        </div>
      </EmptyBoundary>
      {editing !== null && onSaveFood && onCreateAisle && (
        <FoodEditSheet
          open
          food={foodRow(editing)}
          packs={packs.filter((pack) => pack.foodId === editing.id)}
          aisles={aisles}
          units={units}
          busy={busy}
          onCancel={() => !busy && setEditing(null)}
          onSave={(patch) => void onSaveFood(patch).then((saved) => saved && setEditing(null))}
          onCreateAisle={onCreateAisle}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title={`Clear ${tickedCount} ticked ${tickedCount === 1 ? "item" : "items"}?`}
          aria-label="Clear ticked items"
          confirmLabel="Clear"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onClearTicked();
          }}
        >
          They come off the list for good.
        </ConfirmDialog>
      )}
    </Page>
  );
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /**
   * By aisle (the shop's order, each line with the dishes it is for under it,
   * ticked lines sunk to the foot) or by meal
   * (each dish's lines, ticked ones left in place). The device remembers it.
   */
  view?: ShoppingView;
  onViewChange?: (view: ShoppingView) => void;
  /** Every aisle, in `position` order, for the "Set aisle" Select. Empty hides the control. */
  aisles?: readonly Aisle[];
  /** Every food's sizes: the aisle view rounds a line up to whole packs of them. */
  packs?: readonly FoodPack[];
  /** Every unit: the sizes' own, and the food sheet's. */
  units?: readonly Unit[];
  /**
   * The food sheet's Save, from a row's "Edit food": resolves true once
   * saved, and the sheet closes; false leaves it open. Absent (with
   * `onCreateAisle`) hides "Edit food".
   */
  onSaveFood?: (patch: FoodPatch) => Promise<boolean>;
  /** The sheet's Aisle picker creating one by name. */
  onCreateAisle?: (name: string) => Promise<Aisle>;
  /** A line typed into the box at the top, already trimmed and never empty. */
  onAdd: (text: string) => void;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClearTicked: () => void;
  /** A row's food has no aisle and one was picked from the Select. */
  onSetAisle?: (foodId: string, aisleId: string) => void;
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
