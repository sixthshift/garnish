import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { Select } from "@sixthshift/design-system/select";
import { useState } from "react";
import type { Aisle } from "../../../domain/recipe/recipe";
import { groupByAisle, shoppingItemLabel, sourceLabel, type ShoppingItem } from "../../../domain/shopping/shopping";
import { pendingLabel, type OutboxEntry } from "../../../lib/outbox";
import { updateFood } from "../../../server/fns/foods";
import { removeShoppingItem, tickShoppingItem } from "../../../server/fns/shopping";

/** The list itself, writes injected. Rendered by the route and by the tests. */
export function ShoppingListView({
  items,
  aisles = [],
  onAdd,
  onTick,
  onRemove,
  onClearTicked,
  onSetAisle = () => {},
  busy = false,
  pending = 0,
  offline = false,
}: ShoppingListViewProps) {
  const groups = groupByAisle(items);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1">Shopping</Heading>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <Badge intent="warning" data-testid="shopping-pending">
              {pendingLabel(pending)}
            </Badge>
          )}
          {items.length > 0 && <Muted as="p">{toBuyLabel(items)}</Muted>}
        </div>
      </div>

      <AddItemForm onAdd={onAdd} busy={busy || offline} />

      <EmptyBoundary
        isEmpty={items.length === 0}
        fallback={
          <div className="flex flex-col gap-1 py-8 text-center" data-testid="shopping-empty">
            <p className="font-medium">Nothing on the list.</p>
            <Muted as="p">Type a line above, or add a recipe's ingredients from its page.</Muted>
          </div>
        }
      >
        <div className="flex flex-col gap-6" data-testid="shopping-groups">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1" aria-label={group.name} data-testid="shopping-group">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle as="h2">{group.name}</SectionTitle>
                {group.ticked && (
                  <Button type="button" variant="ghost" intent="danger" size="sm" disabled={busy || offline} onClick={onClearTicked}>
                    Clear ticked
                  </Button>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {group.items.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    aisles={aisles}
                    onTick={onTick}
                    onRemove={onRemove}
                    onSetAisle={onSetAisle}
                    busy={busy}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </EmptyBoundary>
    </div>
  );
}

/**
 * One line: the tick box, the amount and food (or the text), and a chevron
 * that expands where it came from. The whole summary is the chevron's target,
 * so the tap area is the row rather than the glyph.
 */
function ShoppingRow({
  item,
  aisles,
  onTick,
  onRemove,
  onSetAisle,
  busy,
}: {
  item: ShoppingItem;
  aisles: readonly Aisle[];
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onSetAisle: (foodId: string, aisleId: string) => void;
  busy: boolean;
}) {
  const label = shoppingItemLabel(item);
  const food = item.food;
  const needsAisle = food !== null && food.aisle === null;
  return (
    <li className="flex items-start gap-3" data-testid="shopping-row" data-ticked={item.ticked ? "true" : "false"}>
      <Checkbox
        checked={item.ticked}
        disabled={busy}
        className="mt-3.5"
        aria-label={label}
        onCheckedChange={(next) => onTick(item.id, next)}
      />
      <details className="group min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden">
          <span className={item.ticked ? "min-w-0 text-fg-subtle line-through" : "min-w-0"}>{label}</span>
          <span aria-hidden="true" className="shrink-0 text-fg-subtle transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="flex flex-col items-start gap-2 pb-3" data-testid="shopping-sources">
          {item.sources.length === 0 ? (
            <Muted as="p">Added by hand</Muted>
          ) : (
            <ul className="flex flex-col gap-1">
              {item.sources.map((source) => (
                <li key={source.id} className="text-sm text-fg-subtle">
                  {sourceLabel(source)}
                </li>
              ))}
            </ul>
          )}
          {needsAisle && (
            <div className="flex items-center gap-2" data-testid="shopping-set-aisle">
              <Muted as="span">Set aisle</Muted>
              <Select
                aria-label={`Aisle for ${food.name}`}
                placeholder="Choose an aisle"
                options={aisles.map((aisle) => ({ value: aisle.id, label: aisle.name }))}
                disabled={busy}
                onValueChange={(aisleId) => onSetAisle(food.id, aisleId)}
              />
            </div>
          )}
          <Button type="button" variant="link" intent="danger" size="sm" disabled={busy} onClick={() => onRemove(item.id)}>
            Remove
          </Button>
        </div>
      </details>
    </li>
  );
}

/** The box at the top: Enter adds a free-text line and clears the field. */
function AddItemForm({ onAdd, busy }: { onAdd: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const line = text.trim();
    if (line === "") return;
    onAdd(line);
    setText("");
  };
  return (
    <form onSubmit={submit} data-testid="shopping-add">
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
        name="item"
        placeholder="Add an item"
        aria-label="Add an item"
        enterKeyHint="done"
      />
    </form>
  );
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /** Every aisle, in `position` order, for the "Set aisle" Select (M31.6). Empty hides the control. */
  aisles?: readonly Aisle[];
  /** A line typed into the box at the top, already trimmed and never empty. */
  onAdd: (text: string) => void;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClearTicked: () => void;
  /** M31.6: a row's food has no aisle and one was picked from the Select. */
  onSetAisle?: (foodId: string, aisleId: string) => void;
  /** A write is in flight: every control is disabled, as the editor's SaveBar does. */
  busy?: boolean;
  /** How many ticks are queued for the server (M31.5). Shown in the header; 0 shows nothing. */
  pending?: number;
  /**
   * No network: adding a line and clearing the ticked are refused (they create
   * and destroy rows), while ticking and removing queue. The one exception to
   * the editor's "writes are never attempted offline".
   */
  offline?: boolean;
};

/** "3 items" / "1 item", ticked ones excluded: what is still to buy. Pure. */
export function toBuyLabel(items: readonly ShoppingItem[]): string {
  const count = items.filter((item) => !item.ticked).length;
  return `${count} ${count === 1 ? "item" : "items"} to buy`;
}

/** M31.6: the "Set aisle" Select writes straight through `updateFood`. One line so the route and the tests share it. */
export function setFoodAisle(foodId: string, aisleId: string): Promise<unknown> {
  return updateFood({ data: { id: foodId, aisleId } });
}

/** One queued write, sent. The list's two offline-able writes and nothing else. */
export function sendOutboxEntry(entry: OutboxEntry): Promise<unknown> {
  if (entry.kind === "remove") return removeShoppingItem({ data: { id: entry.itemId } });
  return tickShoppingItem({ data: { id: entry.itemId, ticked: entry.kind === "tick" } });
}
