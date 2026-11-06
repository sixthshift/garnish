import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { ToggleGroup } from "@sixthshift/design-system/toggle-group";
import { useState } from "react";
import { Page, PageHeader } from "../../../../components/Page";
import { pendingLabel } from "../../../../lib/outbox";
import type { ShoppingView } from "../../../../lib/prefs";
import { dayLabel } from "../../../plan/plan";
import { groupByAisle, groupByMeal, mealsOf, sizesByFood } from "../../shopping";
import { AddItemForm } from "../AddItemForm";
import { ClearTickedDialog } from "../ClearTickedDialog";
import type { ShoppingListViewProps } from "../ShoppingListView";
import { ShoppingRow } from "../ShoppingRow";
import { toBuyLabel } from "../shoppingListActions";

const VIEWS = [
  { value: "aisles", label: "Aisles" },
  { value: "meals", label: "Meals" },
] as const;

const isView = (value: string): value is ShoppingView => VIEWS.some((view) => view.value === value);

/** A phone's list: one column, by aisle or by meal. */
export function ShoppingList({
  items,
  view = "aisles",
  onViewChange = () => {},
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
  const rowProps = { onTick, onRemove, busy };
  const sizes = sizesByFood(packs, units);
  const [confirming, setConfirming] = useState(false);
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
                          <ShoppingRow key={row.item.id} item={row.item} label={row.label} {...rowProps} />
                        ))}
                      </ul>
                    </section>
                  );
                })}
          </div>
        </div>
      </EmptyBoundary>
      {confirming && (
        <ClearTickedDialog
          count={tickedCount}
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
