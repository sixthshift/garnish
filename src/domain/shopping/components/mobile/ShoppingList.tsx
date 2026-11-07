import { Badge } from "@sixthshift/design-system/badge";
import { Heading } from "@sixthshift/design-system/heading";
import { Muted } from "@sixthshift/design-system/muted";
import { ProgressBar } from "@sixthshift/design-system/progress-bar";
import { useState } from "react";
import { Page } from "../../../../components/Page";
import { pendingLabel } from "../../../../lib/outbox";
import { groupByAisle, mealKeysOf, mealsOf, shoppingMeals, sizesByFood } from "../../shopping";
import { AddItemForm } from "../AddItemForm";
import { ClearTickedDialog } from "../ClearTickedDialog";
import type { ShoppingListViewProps } from "../ShoppingListView";
import { ShoppingRow } from "../ShoppingRow";
import { MealChips } from "./MealChips";
import { TrolleySheet } from "./TrolleySheet";

/**
 * A phone's list, for use in the shop (decisions.md row 208): how far along
 * the trip is, the add box at the top, the meals as chips that narrow the
 * list to one dish, then the aisles in shop order with each aisle's name held
 * at the top while you are in it. A tap, the box or a swipe right puts a line
 * in the trolley, which leaves the aisles for a bar at the foot that opens
 * what is in it.
 */
export function ShoppingList({
  items,
  packs = [],
  units = [],
  onAdd,
  onTick,
  onRemove,
  onClearTicked,
  busy = false,
  pending = 0,
  offline = false,
}: ShoppingListViewProps) {
  const sizes = sizesByFood(packs, units);
  const [confirming, setConfirming] = useState(false);
  const [trolleyOpen, setTrolleyOpen] = useState(false);
  // The chosen meal is for this trip round the shop, not kept: the list opens on All.
  const [chosen, setChosen] = useState<string | null>(null);

  const ticked = items.filter((item) => item.ticked);
  const unticked = items.length - ticked.length;
  const meals = shoppingMeals(items);
  // A meal that has left the list (its lines cleared or removed) no longer narrows it.
  const meal = meals.find((candidate) => candidate.key === chosen) ?? null;
  const shown = meal === null ? items : items.filter((item) => mealKeysOf(item).includes(meal.key));
  const aisles = groupByAisle(shown).filter((group) => !group.ticked);
  // The last line taken back out empties the trolley and closes its sheet, so the next tick does not open it again.
  if (trolleyOpen && ticked.length === 0) setTrolleyOpen(false);

  return (
    <Page width="focus" className="gap-4">
      <div className="flex flex-col gap-3" data-page-header="">
        <div className="flex items-end justify-between gap-3">
          <Heading as="h1">Shopping</Heading>
          <div className="flex items-center gap-2 pb-0.5">
            {pending > 0 && (
              <Badge intent="warning" data-testid="shopping-pending">
                {pendingLabel(pending)}
              </Badge>
            )}
            {items.length > 0 && (
              <Muted as="p" data-testid="shopping-progress-label">
                <span className="font-semibold text-fg-normal">{ticked.length}</span> of {items.length}
              </Muted>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <ProgressBar completed={ticked.length} total={items.length} showFraction={false} label="In the trolley" className="[&_[role=progressbar]]:h-2.5" />
        )}
      </div>

      <AddItemForm onAdd={onAdd} busy={busy} />

      {items.length === 0 ? (
        <div className="flex flex-col gap-1 py-8 text-center" data-testid="shopping-empty">
          <p className="font-medium">Nothing on the list.</p>
          <Muted as="p">Type a line above, or add a recipe's ingredients from its page.</Muted>
        </div>
      ) : (
        <>
          {meals.length > 0 && <MealChips meals={meals} left={unticked} chosen={meal?.key ?? null} onChoose={setChosen} />}

          {aisles.length === 0 ? (
            <p className="py-8 text-center font-medium text-fg-success" data-testid="shopping-done" role="status">
              {meal === null ? "✓ Everything is in the trolley." : `✓ All of ${meal.name} is in the trolley.`}
            </p>
          ) : (
            <div className="flex flex-col gap-2" data-testid="shopping-groups">
              {aisles.map((group) => (
                <section key={group.key} aria-label={group.name} data-testid="shopping-group">
                  {/* Held at the top of the screen while its lines scroll under it. */}
                  <div className="sticky top-0 z-content-sticky -mx-4 flex items-baseline justify-between gap-3 bg-bg-subtle px-4 pt-3 pb-1.5">
                    <h2 className="font-semibold text-fg-subtle text-xs uppercase tracking-wider">{group.name}</h2>
                    <span className="font-semibold text-fg-subtle text-xs tabular-nums">{group.items.length}</span>
                  </div>
                  <ul className="flex flex-col divide-y divide-border-subtle">
                    {group.items.map((item) => (
                      <ShoppingRow
                        key={item.id}
                        item={item}
                        meals={mealsOf(item)}
                        sizes={item.food === null ? undefined : (sizes.get(item.food.id) ?? [])}
                        onTick={onTick}
                        onRemove={onRemove}
                        busy={busy}
                        big
                        trolley
                      />
                    ))}
                  </ul>
                </section>
              ))}
              <Muted as="p" className="pt-2 text-center text-sm">
                Swipe right, or tap, to put a line in the trolley.
              </Muted>
            </div>
          )}

          {ticked.length > 0 && (
            // Above the tab bar, in reach of the thumb, wherever the list is scrolled to.
            <button
              type="button"
              aria-haspopup="dialog"
              className="sticky bottom-[calc(var(--app-bar)+var(--app-bar-rise,0px)+0.75rem)] z-content-sticky flex items-center gap-2 rounded-2xl bg-bg-strong px-5 py-3.5 text-left text-fg-on-strong shadow-lg focus-visible:outline-2 focus-visible:outline-border-brand focus-visible:outline-offset-2"
              data-testid="shopping-trolley-bar"
              onClick={() => setTrolleyOpen(true)}
            >
              <span className="flex-1">
                <span className="font-semibold">{ticked.length}</span> in the trolley
              </span>
              <span className="font-medium">Show</span>
            </button>
          )}
        </>
      )}

      {trolleyOpen && (
        <TrolleySheet
          items={ticked}
          onTick={onTick}
          onRemove={onRemove}
          busy={busy}
          offline={offline}
          onClose={() => setTrolleyOpen(false)}
          onClear={() => {
            setTrolleyOpen(false);
            setConfirming(true);
          }}
        />
      )}
      {confirming && (
        <ClearTickedDialog
          count={ticked.length}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onClearTicked();
          }}
        />
      )}
    </Page>
  );
}
