// The shopping list (M31.4): one household list, one page, no owner.
//
// The read is the whole list in `position` order and the page draws
// `groupByAisle` over it (src/domain/shopping.ts) — headings in
// `aisle.position` order, the unaisled under "Other" at the foot of the
// unticked lines, and every ticked line in a "Ticked" group below them with
// **Clear ticked**. The grouping is a pure function so this file stays a
// render of it.
//
// Phone first: the tick box and the row body are both full-height tap targets,
// the sources expand through a `<details>` (the browser's own keyboard and
// aria behaviour, and it renders its content whether open or closed, so a
// test sees it without a DOM), and nothing anywhere depends on hover.
//
// `ShoppingListView` takes its writes as callbacks and renders anywhere; the
// route component binds them to the server functions through `useMutate`, the
// way every other page writes. That split is what the render tests exercise.
import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { EmptyBoundary } from "@sixthshift/design-system/empty-boundary";
import { Heading } from "@sixthshift/design-system/heading";
import { Input } from "@sixthshift/design-system/input";
import { Muted } from "@sixthshift/design-system/muted";
import { SectionTitle } from "@sixthshift/design-system/section-title";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { groupByAisle, shoppingItemLabel, sourceLabel, type ShoppingItem } from "../domain/shopping";
import { useMutate } from "../lib/mutate";
import { notify, notifyError } from "../lib/notify";
import {
  addShoppingItems,
  clearTickedShoppingItems,
  listShoppingItems,
  removeShoppingItem,
  tickShoppingItem,
} from "../server/shopping";

export type ShoppingListData = { items: ShoppingItem[] };

export const Route = createFileRoute("/shopping")({
  loader: async (): Promise<ShoppingListData> => ({ items: await listShoppingItems() }),
  component: ShoppingPage,
});

/** "3 items" / "1 item", ticked ones excluded: what is still to buy. Pure. */
export function toBuyLabel(items: readonly ShoppingItem[]): string {
  const count = items.filter((item) => !item.ticked).length;
  return `${count} ${count === 1 ? "item" : "items"} to buy`;
}

export type ShoppingListViewProps = {
  items: readonly ShoppingItem[];
  /** A line typed into the box at the top, already trimmed and never empty. */
  onAdd: (text: string) => void;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  onClearTicked: () => void;
  /** A write is in flight: every control is disabled, as the editor's SaveBar does. */
  busy?: boolean;
};

/** The list itself, writes injected. Rendered by the route and by the tests. */
export function ShoppingListView({ items, onAdd, onTick, onRemove, onClearTicked, busy = false }: ShoppingListViewProps) {
  const groups = groupByAisle(items);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Heading as="h1">Shopping</Heading>
        {items.length > 0 && <Muted as="p">{toBuyLabel(items)}</Muted>}
      </div>

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
        <div className="flex flex-col gap-6" data-testid="shopping-groups">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1" aria-label={group.name} data-testid="shopping-group">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle as="h2">{group.name}</SectionTitle>
                {group.ticked && (
                  <Button type="button" variant="ghost" intent="danger" size="sm" disabled={busy} onClick={onClearTicked}>
                    Clear ticked
                  </Button>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {group.items.map((item) => (
                  <ShoppingRow key={item.id} item={item} onTick={onTick} onRemove={onRemove} busy={busy} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </EmptyBoundary>
    </div>
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

/**
 * One line: the tick box, the amount and food (or the text), and a chevron
 * that expands where it came from. The whole summary is the chevron's target,
 * so the tap area is the row rather than the glyph.
 */
function ShoppingRow({
  item,
  onTick,
  onRemove,
  busy,
}: {
  item: ShoppingItem;
  onTick: (id: string, ticked: boolean) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const label = shoppingItemLabel(item);
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
          <Button type="button" variant="link" intent="danger" size="sm" disabled={busy} onClick={() => onRemove(item.id)}>
            Remove
          </Button>
        </div>
      </details>
    </li>
  );
}

function ShoppingPage() {
  const { items } = Route.useLoaderData();
  const mutate = useMutate();
  const [busy, setBusy] = useState(false);

  const write = async (what: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await mutate(run);
    } catch (error) {
      notifyError(what, error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShoppingListView
      items={items}
      busy={busy}
      onAdd={(text) => void write("Couldn't add the item", () => addShoppingItems({ data: { items: [{ text }] } }))}
      onTick={(id, ticked) => void write("Couldn't tick the item", () => tickShoppingItem({ data: { id, ticked } }))}
      onRemove={(id) => void write("Couldn't remove the item", () => removeShoppingItem({ data: { id } }))}
      onClearTicked={() =>
        void write("Couldn't clear the ticked items", async () => {
          const { removed } = await clearTickedShoppingItems();
          notify({ intent: "success", title: `${removed} ${removed === 1 ? "item" : "items"} cleared` });
        })
      }
    />
  );
}
