import { Button } from "@sixthshift/design-system/button";
import { Checkbox } from "@sixthshift/design-system/checkbox";
import { Muted } from "@sixthshift/design-system/muted";
import { cn } from "@sixthshift/design-system/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { tickShoppingItem } from "../../../../api/rpc/shopping";
import { ShoppingEmpty } from "../../../../components/shopping/ShoppingEmpty";
import { groupByAisle, type ShoppingItem, shoppingItemLabel } from "../../../shopping/shopping";
import { listProgress } from "../../home";
import { ProgressRing } from "../ProgressRing";
import { Tile } from "./Tile";

/** How many lines the tile lists: what fits in four rows of the grid, the rest is the list's. */
const SHOWN = 8;

/**
 * The shopping list on a desktop's Home: a ring of how much is ticked, what is
 * left, and the next few lines in shop order (the list page's aisle order)
 * with boxes that tick them for real. A tick shows at once and the page
 * reloads behind it, so the ticked line gives way to the next; if it cannot
 * be saved the box goes back. Queuing a tick made offline is the list page's
 * job, where the shopping happens.
 */
export function ShoppingTile({ items }: { items: readonly ShoppingItem[] | null }) {
  const router = useRouter();
  // Ticks made here that the loader has not caught up with yet.
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  if (items === null) {
    return (
      <Tile id="to-buy" title="Shopping" className="row-span-4">
        <Muted as="p">The list couldn't be read just now.</Muted>
        <OpenTheList />
      </Tile>
    );
  }

  // Nothing on it: the list's own empty state, with this week's plan a press away.
  if (items.length === 0) {
    return (
      <Tile id="to-buy" title="Shopping" className="row-span-4">
        <ShoppingEmpty compact className="my-auto" />
      </Tile>
    );
  }

  const shown = items.map((item) => (item.id in ticks ? { ...item, ticked: ticks[item.id] ?? item.ticked } : item));
  const { ticked, total } = listProgress(shown);
  const left = total - ticked;
  // Unticked as the loader read them, so a line ticked here stays put (struck) until the reload takes it away.
  const next = groupByAisle(items)
    .filter((group) => !group.ticked)
    .flatMap((group) =>
      group.items.map((item) => ({ item: shown.find((line) => line.id === item.id) ?? item, aisle: group.aisle === null ? null : group.name }))
    )
    .slice(0, SHOWN);

  const forget = (id: string) =>
    setTicks((current) => {
      const { [id]: _, ...rest } = current;
      return rest;
    });
  const tick = async (id: string, value: boolean) => {
    setTicks((current) => ({ ...current, [id]: value }));
    // Saved, the reloaded list now says so; not saved, the box goes back. Either way the tile's own word is dropped.
    await tickShoppingItem({ data: { id, ticked: value } })
      .then(() => router.invalidate())
      .catch(() => {})
      .finally(() => forget(id));
  };

  return (
    <Tile id="to-buy" className="row-span-4">
      <div className="flex items-center gap-4">
        <ProgressRing ticked={ticked} total={total} />
        <div className="flex min-w-0 flex-col">
          <h2 id="to-buy" className="font-display text-xl font-semibold text-fg-strong">
            {total === 0 ? "Nothing on the list" : left === 0 ? "All ticked" : `${left} to buy`}
          </h2>
          {total > 0 && <Muted as="p">{ticked} ticked</Muted>}
        </div>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {next.map(({ item, aisle }) => {
          const label = shoppingItemLabel(item);
          return (
            <li key={item.id} className="flex items-center gap-2.5 border-b border-border-subtle py-1.5 last:border-b-0">
              <Checkbox checked={item.ticked} aria-label={label} onCheckedChange={(value) => void tick(item.id, value)} />
              <span className={cn("min-w-0 flex-1 truncate", item.ticked && "text-fg-subtle line-through")}>{label}</span>
              {aisle !== null && <span className="shrink-0 text-xs text-fg-subtle">{aisle}</span>}
            </li>
          );
        })}
      </ul>
      <OpenTheList />
    </Tile>
  );
}

function OpenTheList() {
  return (
    <Button asChild variant="outline" intent="neutral" size="sm" className="mt-auto self-start">
      <Link to="/shopping">Open the list</Link>
    </Button>
  );
}
